// src/model/ProjectPage/ProjectsModel.ts
import { D1Database } from "@cloudflare/workers-types";

export interface Project {
  id: number;
  title: string;
  type: 'video' | 'image';
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number;
  created_at: string;
}

// For creating a project (no ID, no created_at)
export interface ProjectCreate {
  title: string;
  type: 'video' | 'image';
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order?: number;
}

export class ProjectsModel {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async listAll(): Promise<Project[]> {
    const query = `SELECT * FROM Projects ORDER BY display_order ASC`;
    const { results } = await this.db.prepare(query).all();

    if (!results) return [];

    // Map manually to Project
    return results.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      type: r.type === 'video' ? 'video' : 'image',
      url: String(r.url),
      short_description: String(r.short_description),
      long_description: String(r.long_description),
      project_link: String(r.project_link),
      display_order: Number(r.display_order),
      created_at: String(r.created_at)
    }));
  }

  async getById(id: number): Promise<Project | null> {
    const query = `SELECT * FROM Projects WHERE id=?`;
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
      project_link: String(r.project_link),
      display_order: Number(r.display_order),
      created_at: String(r.created_at)
    };
  }

  async create(project: ProjectCreate): Promise<number> {
    const query = `
      INSERT INTO Projects 
        (title, type, url, short_description, long_description, project_link, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.prepare(query).bind([
      project.title,
      project.type,
      project.url,
      project.short_description,
      project.long_description,
      project.project_link,
      project.display_order ?? 0
    ]).run();

    // Fetch last inserted ID safely
    const { results } = await this.db.prepare(`SELECT id FROM Projects ORDER BY id DESC LIMIT 1`).all();
    return results?.[0]?.id ? Number(results[0].id) : 0;
  }

  async update(id: number, project: Partial<ProjectCreate>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(project)) {
      fields.push(`${key}=?`);
      values.push(value);
    }
    if (!fields.length) return;

    const query = `UPDATE Projects SET ${fields.join(', ')} WHERE id=?`;
    await this.db.prepare(query).bind([...values, id]).run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare(`DELETE FROM Projects WHERE id=?`).bind([id]).run();
  }
}
