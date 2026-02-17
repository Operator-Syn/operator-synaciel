// src/model/ProjectPage/GalleryModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface GalleryItem {
  id: number;
  project_id: number;
  type: 'video' | 'image';
  url: string;
  display_order: number;
}

// For creating a new gallery item
export interface GalleryCreate {
  project_id: number;
  type: 'video' | 'image';
  url: string;
  display_order?: number;
}

export class GalleryModel {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async listByProject(project_id: number): Promise<GalleryItem[]> {
    const query = `SELECT * FROM GalleryItems WHERE project_id=? ORDER BY display_order ASC`;
    const { results } = await this.db.prepare(query).bind([project_id]).all();

    if (!results) return [];

    // Map manually
    return results.map((r) => ({
      id: Number(r.id),
      project_id: Number(r.project_id),
      type: r.type === 'video' ? 'video' : 'image',
      url: String(r.url),
      display_order: Number(r.display_order)
    }));
  }

  async create(item: GalleryCreate): Promise<void> {
    const query = `
      INSERT INTO GalleryItems (project_id, type, url, display_order)
      VALUES (?, ?, ?, ?)
    `;
    await this.db.prepare(query).bind([
      item.project_id,
      item.type,
      item.url,
      item.display_order ?? 0
    ]).run();
  }

  async update(id: number, item: Partial<Omit<GalleryCreate, 'project_id'>>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(item)) {
      fields.push(`${key}=?`);
      values.push(value);
    }
    if (!fields.length) return;

    const query = `UPDATE GalleryItems SET ${fields.join(', ')} WHERE id=?`;
    await this.db.prepare(query).bind([...values, id]).run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare(`DELETE FROM GalleryItems WHERE id=?`).bind([id]).run();
  }
}
