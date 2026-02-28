// src/model/SnippetsPageModel.ts
import { D1Database, R2Bucket } from "@cloudflare/workers-types";

// 1. Raw Row Shape (Matches DB Schema exactly)
interface SnippetRow {
  id: number;
  parent_id: number | null;
  name: string;
  type: 'dir' | 'file';
  storage_path: string | null;
  size_bytes: number;
  file_format: 'pdf' | 'md' | null;
  modified_at: string;
}

// 2. The Clean Recursive Output Structure (File Tree)
export interface SnippetNode {
  id: number;
  name: string;
  type: 'dir' | 'file';
  modified: string;
  path?: string | null;      
  size?: number;             
  format?: 'pdf' | 'md';     
  children?: SnippetNode[];  
}

export class SnippetsPageModel {
  private db: D1Database;
  private bucket: R2Bucket;

  constructor(db: D1Database, bucket: R2Bucket) {
    this.db = db;
    this.bucket = bucket;
  }

  // --- NEW: GET SINGLE RESOURCE ---
  async getSnippetById(id: number): Promise<SnippetNode | null> {
    const query = `
      SELECT id, parent_id, name, type, storage_path, size_bytes, file_format, modified_at
      FROM Snippets WHERE id = ?
    `;
    const row = await this.db.prepare(query).bind(id).first<SnippetRow>();
    
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      modified: row.modified_at,
      path: row.storage_path,
      ...(row.type === 'file' && { 
          size: row.size_bytes, 
          format: row.file_format || undefined 
      }),
      ...(row.type === 'dir' && { children: [] } )
    };
  }

  async getFileTree(): Promise<SnippetNode[]> {
    const query = `
      SELECT 
        id, parent_id, name, type, storage_path, 
        size_bytes, file_format, modified_at
      FROM Snippets
      ORDER BY type ASC, name ASC
    `;
    const { results } = await this.db.prepare(query).all<SnippetRow>();
    return this.buildTree(results);
  }

  // --- NEW: DOWNLOAD FILE CONTENT ---
  async getFileContent(id: number) {
    const node = await this.getSnippetById(id);
    if (!node || node.type === 'dir' || !node.path) return null;

    const object = await this.bucket.get(node.path);
    if (!object) return null;

    return {
      stream: object.body, // Naming this 'stream' to match Controller usage
      headers: {
        'Content-Type': node.format === 'pdf' ? 'application/pdf' : 'text/markdown',
        'Content-Disposition': `attachment; filename="${node.name}"`,
        'Content-Length': node.size?.toString() || '',
      }
    };
  }

  async createFolder(name: string, parentId: number | null): Promise<SnippetNode> {
    const query = `
      INSERT INTO Snippets (parent_id, name, type, size_bytes, modified_at)
      VALUES (?, ?, 'dir', 0, datetime('now'))
      RETURNING id, modified_at
    `;
    const result = await this.db.prepare(query).bind(parentId, name).first<{ id: number; modified_at: string }>();
    if (!result) throw new Error("Failed to create folder");
    return { id: result.id, name, type: 'dir', modified: result.modified_at, children: [] };
  }

  async uploadFile(file: File, parentId: number | null): Promise<SnippetNode> {
    const fileExt = file.name.split('.').pop() || "";
    const storagePath = `snippets/${crypto.randomUUID()}.${fileExt}`;

    await this.bucket.put(storagePath, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    try {
      const query = `
        INSERT INTO Snippets (parent_id, name, type, storage_path, size_bytes, file_format, modified_at)
        VALUES (?, ?, 'file', ?, ?, ?, datetime('now'))
        RETURNING id, modified_at
      `;
      const result = await this.db.prepare(query).bind(parentId, file.name, storagePath, file.size, fileExt).first<{ id: number; modified_at: string }>();
      if (!result) throw new Error("Failed to insert row");

      return {
        id: result.id,
        name: file.name,
        type: 'file',
        modified: result.modified_at,
        path: storagePath,
        size: file.size,
        format: fileExt as 'pdf' | 'md'
      };
    } catch (dbError) {
      await this.bucket.delete(storagePath);
      throw new Error("Database insert failed.");
    }
  }

  // --- NEW: UPDATE (Rename/Move) ---
  async updateNode(id: number, updates: { name?: string; parent_id?: number | null }): Promise<SnippetNode | null> {
    const { name, parent_id } = updates;
    
    if (parent_id !== undefined && parent_id === id) {
      throw new Error("Cannot move a folder into itself.");
    }

    const parts: string[] = [];
    const args: any[] = [];

    if (name !== undefined) { parts.push("name = ?"); args.push(name); }
    if (parent_id !== undefined) { parts.push("parent_id = ?"); args.push(parent_id); }

    if (parts.length > 0) {
      args.push(id);
      const query = `UPDATE Snippets SET ${parts.join(', ')}, modified_at = datetime('now') WHERE id = ?`;
      await this.db.prepare(query).bind(...args).run();
    }
    
    return this.getSnippetById(id);
  }

  async deleteNode(id: number): Promise<void> {
    const findQuery = `
      WITH RECURSIVE descendant AS (
        SELECT id, type, storage_path FROM Snippets WHERE id = ?
        UNION ALL
        SELECT s.id, s.type, s.storage_path FROM Snippets s
        JOIN descendant d ON s.parent_id = d.id
      )
      SELECT type, storage_path FROM descendant;
    `;
    
    const { results } = await this.db.prepare(findQuery).bind(id).all<{ type: string, storage_path: string | null }>();
    if (results.length === 0) return;

    const filePaths = results
      .filter(r => r.type === 'file' && r.storage_path)
      .map(r => r.storage_path as string);

    if (filePaths.length > 0) {
      await this.bucket.delete(filePaths);
    }

    const deleteQuery = `
      DELETE FROM Snippets WHERE id IN (
        WITH RECURSIVE descendant AS (
          SELECT id FROM Snippets WHERE id = ?
          UNION ALL
          SELECT s.id FROM Snippets s
          JOIN descendant d ON s.parent_id = d.id
        )
        SELECT id FROM descendant
      )
    `;
    await this.db.prepare(deleteQuery).bind(id).run();
  }

  private buildTree(rows: SnippetRow[]): SnippetNode[] {
    const nodeMap = new Map<number, SnippetNode>();
    const tree: SnippetNode[] = [];

    rows.forEach(row => {
      const node: SnippetNode = {
        id: row.id,
        name: row.name,
        type: row.type,
        modified: row.modified_at,
        path: row.storage_path, 
        ...(row.type === 'file' && { 
            size: row.size_bytes, 
            format: row.file_format || undefined 
        }),
        ...(row.type === 'dir' && { children: [] } )
      };
      nodeMap.set(row.id, node);
    });

    rows.forEach(row => {
      const node = nodeMap.get(row.id)!;
      if (row.parent_id === null) {
        tree.push(node);
      } else {
        const parent = nodeMap.get(row.parent_id);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      }
    });
    return tree;
  }
}