//src/model/HomePage/SectionsModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface SectionRow { id: number; title: string; section_type: string; display_order: number; }

export class SectionsModel {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }

  async list() {
    const res = await this.db.prepare("SELECT id, title, section_type, display_order FROM sections ORDER BY display_order ASC, id ASC").all<SectionRow>();
    return res.results;
  }

  async create(title: string, type: string, order: number) {
    return this.db.prepare(
      "INSERT INTO sections (title, section_type, display_order) VALUES (?, ?, ?) RETURNING id, title, section_type, display_order"
    ).bind(title, type, order).first<SectionRow>();
  }

  async update(id: number, title: string, type: string, display_order: number) {
    return this.db.prepare(
      "UPDATE sections SET title=?, section_type=?, display_order=? WHERE id=? RETURNING id, title, section_type, display_order"
    ).bind(title, type, display_order, id).first<SectionRow>();
  }

  async delete(id: number) {
    await this.db.prepare("DELETE FROM sections WHERE id=?").bind(id).run();
  }
}
