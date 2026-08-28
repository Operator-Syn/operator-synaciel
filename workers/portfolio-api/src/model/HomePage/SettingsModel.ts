// workers/portfolio-api/src/model/HomePage/SettingsModel.ts
import type { D1Database } from "@cloudflare/workers-types";

export interface SettingRow {
  key: string;
  value: string;
}

const PUBLIC_SETTING_KEYS = [
  "headerPhrase",
  "mobileHeaderPhrase",
  "profileImage",
  "status",
] as const;

export class SettingsModel {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async listPublic() {
    const placeholders = PUBLIC_SETTING_KEYS.map(() => "?").join(", ");
    const res = await this.db
      .prepare(`SELECT key, value FROM site_settings WHERE key IN (${placeholders})`)
      .bind(...PUBLIC_SETTING_KEYS)
      .all<SettingRow>();

    return Object.fromEntries(res.results.map((r) => [r.key, r.value]));
  }

  async create(key: string, value: string) {
    // FIX: Use INSERT OR REPLACE to avoid UNIQUE constraint errors
    return this.db
      .prepare(
        "INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?) RETURNING key, value",
      )
      .bind(key, value)
      .first<SettingRow>();
  }

  async update(key: string, value: string) {
    return this.db
      .prepare("UPDATE site_settings SET value=? WHERE key=? RETURNING key, value")
      .bind(value, key)
      .first<SettingRow>();
  }

  async delete(key: string) {
    await this.db.prepare("DELETE FROM site_settings WHERE key=?").bind(key).run();
  }
}
