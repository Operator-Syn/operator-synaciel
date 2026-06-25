// src/model/HomePage/SettingsModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface SettingRow { key: string; value: string; }

export class SettingsModel {
  private db: D1Database;
  constructor(db: D1Database) { this.db = db; }

  async list() {
    const res = await this.db.prepare("SELECT key, value FROM site_settings").all<SettingRow>();
    return Object.fromEntries(res.results.map(r => [r.key, r.value]));
  }

  async create(key: string, value: string) {
    // FIX: Use INSERT OR REPLACE to avoid UNIQUE constraint errors
    return this.db.prepare(
      "INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?) RETURNING key, value"
    ).bind(key, value).first<SettingRow>();
  }

  async update(key: string, value: string) {
    return this.db.prepare(
      "UPDATE site_settings SET value=? WHERE key=? RETURNING key, value"
    ).bind(value, key).first<SettingRow>();
  }

  async delete(key: string) {
    await this.db.prepare("DELETE FROM site_settings WHERE key=?").bind(key).run();
  }
}
