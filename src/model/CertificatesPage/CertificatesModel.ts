// src/model/CertificatesPage/CertificatesModel.ts

import { D1Database } from "@cloudflare/workers-types";

export interface Certificate {
  id: number;
  title: string;
  type: 'video' | 'image';
  url: string;
  short_description: string;
  long_description: string;
  certificate_link: string | null;
  display_order: number;
  created_at: string;
}

export interface CertificateCreate {
  title: string;
  type: 'video' | 'image';
  url: string;
  short_description: string;
  long_description: string;
  certificate_link?: string;
  display_order?: number;
}

export class CertificatesModel {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }

  async listAll(): Promise<Certificate[]> {
    const query = `SELECT * FROM Certificates ORDER BY display_order ASC`;
    const { results } = await this.db.prepare(query).all();

    if (!results) return [];

    return results.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      type: r.type === 'video' ? 'video' : 'image',
      url: String(r.url),
      short_description: String(r.short_description),
      long_description: String(r.long_description),
      certificate_link: r.certificate_link ? String(r.certificate_link) : null,
      display_order: Number(r.display_order),
      created_at: String(r.created_at)
    }));
  }

  async getById(id: number): Promise<Certificate | null> {
    const query = `SELECT * FROM Certificates WHERE id=?`;
    const { results } = await this.db.prepare(query).bind([id]).all();

    if (!results || results.length === 0) return null;

    const r = results[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      type: r.type === 'video' ? 'video' : 'image',
      url: String(r.url),
      short_description: String(r.short_description),
      long_description: String(r.long_description),
      certificate_link: r.certificate_link ? String(r.certificate_link) : null,
      display_order: Number(r.display_order),
      created_at: String(r.created_at)
    };
  }

  async create(cert: CertificateCreate): Promise<number> {
    const query = `
      INSERT INTO Certificates 
        (title, type, url, short_description, long_description, certificate_link, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.prepare(query).bind([
      cert.title,
      cert.type,
      cert.url,
      cert.short_description,
      cert.long_description,
      cert.certificate_link ?? null,
      cert.display_order ?? 0
    ]).run();

    const { results } = await this.db.prepare(`SELECT id FROM Certificates ORDER BY id DESC LIMIT 1`).all();
    return results?.[0]?.id ? Number(results[0].id) : 0;
  }

  async update(id: number, cert: Partial<CertificateCreate>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(cert)) {
      fields.push(`${key}=?`);
      values.push(value);
    }
    if (!fields.length) return;

    const query = `UPDATE Certificates SET ${fields.join(', ')} WHERE id=?`;
    await this.db.prepare(query).bind([...values, id]).run();
  }

  async delete(id: number): Promise<void> {
    // Note: CertificateItems are deleted via ON DELETE CASCADE in the DB schema
    await this.db.prepare(`DELETE FROM Certificates WHERE id=?`).bind([id]).run();
  }
}