// src/model/CertificatesPage/CertificateItemsModel.ts
import type { D1Database } from "@cloudflare/workers-types";

export interface CertificateItem {
  id: number;
  certificate_id: number;
  type: "video" | "image";
  url: string;
  display_order: number;
}

export interface CertificateItemCreate {
  certificate_id: number;
  type: "video" | "image";
  url: string;
  display_order?: number;
}

export class CertificateItemsModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async listByCertificate(certificate_id: number): Promise<CertificateItem[]> {
    const query = `
      SELECT id, certificate_id, type, url, display_order
      FROM CertificateItems
      WHERE certificate_id = ?
      ORDER BY display_order ASC
    `;

    const { results } = await this.db
      .prepare(query)
      .bind(certificate_id)
      .all();

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((r: any) => ({
      id: Number(r.id),
      certificate_id: Number(r.certificate_id),
      type: r.type === "video" ? "video" : "image",
      url: String(r.url),
      display_order: Number(r.display_order),
    }));
  }

  async create(item: CertificateItemCreate): Promise<void> {
    const query = `
      INSERT INTO CertificateItems (certificate_id, type, url, display_order)
      VALUES (?, ?, ?, ?)
    `;

    await this.db
      .prepare(query)
      .bind(
        item.certificate_id,
        item.type,
        item.url,
        item.display_order ?? 0
      )
      .run();
  }

  async update(
    id: number,
    item: Partial<Omit<CertificateItemCreate, "certificate_id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(item)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    const query = `
      UPDATE CertificateItems
      SET ${fields.join(", ")}
      WHERE id = ?
    `;

    await this.db
      .prepare(query)
      .bind(...values, id)
      .run();
  }

  async delete(id: number): Promise<void> {
    await this.db
      .prepare(`DELETE FROM CertificateItems WHERE id = ?`)
      .bind(id)
      .run();
  }
}