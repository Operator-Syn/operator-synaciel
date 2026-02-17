// src/model/HomePage/ProfileModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface ProfileRow { label: string; value: string; }

export class ProfileModel {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }

  async list() {
    const res = await this.db.prepare("SELECT label, value FROM profile_info ORDER BY display_order").all<ProfileRow>();
    return res.results;
  }

  async create(label: string, value: string, order: number) {
    await this.db.prepare("INSERT INTO profile_info (label, value, display_order) VALUES (?, ?, ?)").bind(label, value, order).run();
  }

  async update(label: string, value: string) {
    await this.db.prepare("UPDATE profile_info SET value=? WHERE label=?").bind(value, label).run();
  }

  async delete(label: string) {
    await this.db.prepare("DELETE FROM profile_info WHERE label=?").bind(label).run();
  }
}