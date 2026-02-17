//src/model/HomePage/SectionItemsModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface SectionItemRow {
  id: number;
  section_id: number;
  label: string | null;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
  display_order: number;
}

export class SectionItemsModel {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }

  async list(sectionId: number) {
    const res = await this.db.prepare(`
      SELECT id, section_id, label, content, image_url, target_url, display_order
      FROM section_items
      WHERE section_id=?
      ORDER BY display_order ASC
    `).bind(sectionId).all<SectionItemRow>();
    return res.results;
  }

  async create(sectionId: number, label: string | null, content: string | null, image_url: string | null, target_url: string | null, order: number) {
    await this.db.prepare(`
      INSERT INTO section_items (section_id, label, content, image_url, target_url, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(sectionId, label, content, image_url, target_url, order).run();
  }

  async update(id: number, label: string | null, content: string | null, image_url: string | null, target_url: string | null) {
    await this.db.prepare(`
      UPDATE section_items
      SET label=?, content=?, image_url=?, target_url=?
      WHERE id=?
    `).bind(label, content, image_url, target_url, id).run();
  }

  async delete(id: number) {
    await this.db.prepare("DELETE FROM section_items WHERE id=?").bind(id).run();
  }
}
