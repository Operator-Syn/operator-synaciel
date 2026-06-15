// src/model/SnippetsPage/SnippetsPageModel.ts

import type {
  D1Database,
  R2Bucket,
  R2ObjectBody,
} from "@cloudflare/workers-types";

type SnippetType = "dir" | "file";
type SnippetFormat = "pdf" | "md";

interface SnippetRow {
  id: number;
  parent_id: number | null;
  name: string;
  type: SnippetType;
  storage_path: string | null;
  size_bytes: number;
  file_format: SnippetFormat | null;
  display_order: number;
  created_at: string;
  modified_at: string;
}

interface ParentRow {
  id: number;
  type: SnippetType;
}

export interface SnippetNode {
  id: number;
  name: string;
  type: SnippetType;
  modified: string;
  display_order?: number;
  path?: string | null;
  size?: number;
  format?: SnippetFormat;
  children?: SnippetNode[];
}

export class SnippetsPageModel {
  private db: D1Database;
  private bucket: R2Bucket;
  private prefix: string;

  constructor(db: D1Database, bucket: R2Bucket, prefix = "snippets/") {
    this.db = db;
    this.bucket = bucket;
    this.prefix = prefix;
  }

  async getSnippetById(id: number): Promise<SnippetNode | null> {
    const row = await this.getRawSnippetById(id);

    if (!row) {
      return null;
    }

    return this.toSnippetNode(row);
  }

  async getFileTree(): Promise<SnippetNode[]> {
    const query = `
      SELECT
        id,
        parent_id,
        name,
        type,
        storage_path,
        size_bytes,
        file_format,
        COALESCE(display_order, 0) AS display_order,
        created_at,
        modified_at
      FROM Snippets
      ORDER BY
        COALESCE(parent_id, 0) ASC,
        display_order ASC,
        CASE type
          WHEN 'dir' THEN 0
          WHEN 'file' THEN 1
          ELSE 2
        END,
        name ASC
    `;

    const { results } = await this.db.prepare(query).all<SnippetRow>();

    return this.buildTree(results);
  }

  async getFileContent(id: number): Promise<{
    stream: R2ObjectBody["body"];
    headers: Record<string, string>;
  } | null> {
    const node = await this.getSnippetById(id);

    if (!node || node.type !== "file" || !node.path || !node.format) {
      return null;
    }

    const object = await this.bucket.get(node.path);

    if (!object) {
      return null;
    }

    return {
      stream: object.body,
      headers: {
        "Content-Type": this.getContentType(node.format),
        "Content-Disposition": `attachment; filename="${this.escapeFilename(
          node.name,
        )}"`,
        "Content-Length": node.size?.toString() ?? "0",
      },
    };
  }

  async createFolder(
    name: string,
    parentId: number | null,
  ): Promise<SnippetNode> {
    await this.validateParent(parentId);

    const displayOrder = await this.getNextDisplayOrder(parentId);

    const query = `
      INSERT INTO Snippets (
        parent_id,
        name,
        type,
        storage_path,
        size_bytes,
        file_format,
        display_order,
        modified_at
      )
      VALUES (?, ?, 'dir', NULL, 0, NULL, ?, datetime('now'))
      RETURNING
        id,
        parent_id,
        name,
        type,
        storage_path,
        size_bytes,
        file_format,
        display_order,
        created_at,
        modified_at
    `;

    const result = await this.db
      .prepare(query)
      .bind(parentId, name, displayOrder)
      .first<SnippetRow>();

    if (!result) {
      throw new Error("Failed to create folder.");
    }

    return this.toSnippetNode(result);
  }

  async uploadFile(file: File, parentId: number | null): Promise<SnippetNode> {
    await this.validateParent(parentId);

    const displayOrder = await this.getNextDisplayOrder(parentId);
    const fileFormat = this.getValidatedFileExtension(file.name);
    const safeName = this.getSafeFilename(file.name);
    const key = `${this.prefix}${Date.now()}-${safeName}`;

    await this.bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || this.getContentType(fileFormat),
      },
    });

    try {
      const query = `
        INSERT INTO Snippets (
          parent_id,
          name,
          type,
          storage_path,
          size_bytes,
          file_format,
          display_order,
          modified_at
        )
        VALUES (?, ?, 'file', ?, ?, ?, ?, datetime('now'))
        RETURNING
          id,
          parent_id,
          name,
          type,
          storage_path,
          size_bytes,
          file_format,
          display_order,
          created_at,
          modified_at
      `;

      const result = await this.db
        .prepare(query)
        .bind(parentId, file.name, key, file.size, fileFormat, displayOrder)
        .first<SnippetRow>();

      if (!result) {
        throw new Error("Failed to insert snippet row.");
      }

      return this.toSnippetNode(result);
    } catch (err: unknown) {
      await this.bucket.delete(key);

      throw err instanceof Error
        ? err
        : new Error("Database insert failed.");
    }
  }

  async updateNode(
    id: number,
    updates: {
      name?: string;
      parent_id?: number | null;
      display_order?: number;
    },
  ): Promise<SnippetNode | null> {
    const existing = await this.getRawSnippetById(id);

    if (!existing) {
      return null;
    }

    const { name, parent_id, display_order } = updates;
    let nextDisplayOrder = display_order;

    if (parent_id !== undefined) {
      if (parent_id === id) {
        throw new Error("Cannot move a snippet into itself.");
      }

      await this.validateParent(parent_id);

      if (existing.type === "dir" && parent_id !== null) {
        await this.validateNoFolderCycle(id, parent_id);
      }

      if (parent_id !== existing.parent_id && nextDisplayOrder === undefined) {
        nextDisplayOrder = await this.getNextDisplayOrder(parent_id);
      }
    }

    const parts: string[] = [];
    const args: unknown[] = [];

    if (name !== undefined) {
      parts.push("name = ?");
      args.push(name);
    }

    if (parent_id !== undefined) {
      parts.push("parent_id = ?");
      args.push(parent_id);
    }

    if (nextDisplayOrder !== undefined) {
      parts.push("display_order = ?");
      args.push(nextDisplayOrder);
    }

    if (parts.length === 0) {
      return this.toSnippetNode(existing);
    }

    args.push(id);

    const query = `
      UPDATE Snippets
      SET
        ${parts.join(", ")},
        modified_at = datetime('now')
      WHERE id = ?
    `;

    await this.db.prepare(query).bind(...args).run();

    return this.getSnippetById(id);
  }

  async deleteNode(id: number): Promise<boolean> {
    const findQuery = `
      WITH RECURSIVE descendants AS (
        SELECT
          id,
          type,
          storage_path
        FROM Snippets
        WHERE id = ?

        UNION ALL

        SELECT
          s.id,
          s.type,
          s.storage_path
        FROM Snippets s
        JOIN descendants d ON s.parent_id = d.id
      )
      SELECT
        type,
        storage_path
      FROM descendants
    `;

    const { results } = await this.db
      .prepare(findQuery)
      .bind(id)
      .all<{
        type: SnippetType;
        storage_path: string | null;
      }>();

    if (results.length === 0) {
      return false;
    }

    const keys = results
      .filter((row) => row.type === "file" && row.storage_path)
      .map((row) => row.storage_path as string);

    if (keys.length > 0) {
      await this.bucket.delete(keys);
    }

    const deleteQuery = `
      DELETE FROM Snippets
      WHERE id IN (
        WITH RECURSIVE descendants AS (
          SELECT id
          FROM Snippets
          WHERE id = ?

          UNION ALL

          SELECT s.id
          FROM Snippets s
          JOIN descendants d ON s.parent_id = d.id
        )
        SELECT id FROM descendants
      )
    `;

    await this.db.prepare(deleteQuery).bind(id).run();

    return true;
  }

  private async getRawSnippetById(id: number): Promise<SnippetRow | null> {
    const query = `
      SELECT
        id,
        parent_id,
        name,
        type,
        storage_path,
        size_bytes,
        file_format,
        COALESCE(display_order, 0) AS display_order,
        created_at,
        modified_at
      FROM Snippets
      WHERE id = ?
    `;

    const row = await this.db.prepare(query).bind(id).first<SnippetRow>();

    return row ?? null;
  }

  private async validateParent(parentId: number | null): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.db
      .prepare(
        `
        SELECT
          id,
          type
        FROM Snippets
        WHERE id = ?
      `,
      )
      .bind(parentId)
      .first<ParentRow>();

    if (!parent) {
      throw new Error("Parent folder not found.");
    }

    if (parent.type !== "dir") {
      throw new Error("Parent must be a folder.");
    }
  }

  private async validateNoFolderCycle(
    folderId: number,
    newParentId: number,
  ): Promise<void> {
    const query = `
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM Snippets
        WHERE parent_id = ?

        UNION ALL

        SELECT s.id
        FROM Snippets s
        JOIN descendants d ON s.parent_id = d.id
      )
      SELECT id
      FROM descendants
      WHERE id = ?
      LIMIT 1
    `;

    const cycle = await this.db
      .prepare(query)
      .bind(folderId, newParentId)
      .first<{ id: number }>();

    if (cycle) {
      throw new Error("Cannot move a folder into one of its descendants.");
    }
  }

  private async getNextDisplayOrder(parentId: number | null): Promise<number> {
    if (parentId === null) {
      const row = await this.db
        .prepare(
          `
          SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
          FROM Snippets
          WHERE parent_id IS NULL
        `,
        )
        .first<{ next_order: number }>();

      return row?.next_order ?? 1;
    }

    const row = await this.db
      .prepare(
        `
        SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
        FROM Snippets
        WHERE parent_id = ?
      `,
      )
      .bind(parentId)
      .first<{ next_order: number }>();

    return row?.next_order ?? 1;
  }

  private buildTree(rows: SnippetRow[]): SnippetNode[] {
    const nodeMap = new Map<number, SnippetNode>();
    const tree: SnippetNode[] = [];

    for (const row of rows) {
      nodeMap.set(row.id, this.toSnippetNode(row));
    }

    for (const row of rows) {
      const node = nodeMap.get(row.id);

      if (!node) {
        continue;
      }

      if (row.parent_id === null) {
        tree.push(node);
        continue;
      }

      const parent = nodeMap.get(row.parent_id);

      if (!parent || parent.type !== "dir" || !parent.children) {
        continue;
      }

      parent.children.push(node);
    }

    return tree;
  }

  private toSnippetNode(row: SnippetRow): SnippetNode {
    const baseNode: SnippetNode = {
      id: row.id,
      name: row.name,
      type: row.type,
      modified: row.modified_at,
      display_order: row.display_order,
      path: row.storage_path,
    };

    if (row.type === "dir") {
      return {
        ...baseNode,
        children: [],
      };
    }

    return {
      ...baseNode,
      size: row.size_bytes,
      format: row.file_format ?? undefined,
    };
  }

  private getValidatedFileExtension(filename: string): SnippetFormat {
    const ext = filename.split(".").pop()?.toLowerCase();

    if (ext !== "pdf" && ext !== "md") {
      throw new Error("Only PDF and Markdown files are supported.");
    }

    return ext;
  }

  private getSafeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  }

  private getContentType(format: SnippetFormat): string {
    if (format === "pdf") {
      return "application/pdf";
    }

    return "text/markdown; charset=utf-8";
  }

  private escapeFilename(filename: string): string {
    return filename.replace(/["\\]/g, "_");
  }
}