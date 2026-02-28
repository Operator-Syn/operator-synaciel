// src/model/HomePage/ProfileModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface ProfileRow { 
  id?: number;
  label: string; 
  value: string; 
  display_order: number; 
}

export class ProfileModel {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }

  async list() {
    const res = await this.db.prepare(
      "SELECT id, label, value, display_order FROM profile_info ORDER BY display_order"
    ).all<ProfileRow>();
    
    return res.results;
  }

  async create(label: string, value: string, display_order: number) {
    await this.db.prepare(
      "INSERT INTO profile_info (label, value, display_order) VALUES (?, ?, ?)"
    ).bind(label, value, display_order).run();
  }

  // ADDED: display_order to the parameters and the SQL query
  async update(label: string, value: string, display_order: number) {
    await this.db.prepare(
      "UPDATE profile_info SET value=?, display_order=? WHERE label=?"
    ).bind(value, display_order, label).run();
  }

  async delete(label: string) {
    await this.db.prepare(
      "DELETE FROM profile_info WHERE label=?"
    ).bind(label).run();
  }
}