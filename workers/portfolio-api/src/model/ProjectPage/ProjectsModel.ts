// workers/portfolio-api/src/model/ProjectPage/ProjectsModel.ts
import type { D1Database } from "@cloudflare/workers-types";
import { parseJsonStringArray, serializeJsonStringArray } from "../../utils/contentValidation";

export interface Project {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  categories: string[];
  stack: string[];
  highlights: string[];
  display_order: number;
  created_at: string;
}

export interface ProjectCreate {
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  categories?: string[];
  stack?: string[];
  highlights?: string[];
  display_order?: number;
}

type ProjectRow = {
  id: number;
  title: string;
  type: "video" | "image";
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  categories: string | null;
  stack: string | null;
  highlights: string | null;
  display_order: number;
  created_at: string;
};

function toProject(row: ProjectRow): Project {
  return {
    id: Number(row.id),
    title: String(row.title),
    type: row.type === "video" ? "video" : "image",
    url: String(row.url),
    short_description: String(row.short_description),
    long_description: String(row.long_description),
    project_link: String(row.project_link),
    categories: parseJsonStringArray(row.categories),
    stack: parseJsonStringArray(row.stack),
    highlights: parseJsonStringArray(row.highlights),
    display_order: Number(row.display_order),
    created_at: String(row.created_at),
  };
}

export class ProjectsModel {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }

  async listAll(): Promise<Project[]> {
    const query = `SELECT * FROM Projects ORDER BY display_order ASC, id ASC`;
    const { results } = await this.db.prepare(query).all<ProjectRow>();

    if (!results) return [];

    return results.map(toProject);
  }

  async getById(id: number): Promise<Project | null> {
    const query = `SELECT * FROM Projects WHERE id=?`;
    const { results } = await this.db.prepare(query).bind(id).all<ProjectRow>();

    if (!results || results.length === 0) return null;

    return toProject(results[0]);
  }

  async create(project: ProjectCreate): Promise<number> {
    const query = `
      INSERT INTO Projects 
        (title, type, url, short_description, long_description, project_link, categories, stack, highlights, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const result = await this.db
      .prepare(query)
      .bind(
        project.title,
        project.type,
        project.url,
        project.short_description,
        project.long_description,
        project.project_link,
        serializeJsonStringArray(project.categories),
        serializeJsonStringArray(project.stack),
        serializeJsonStringArray(project.highlights),
        project.display_order ?? 0,
      )
      .first<{ id: number }>();

    return result?.id ? Number(result.id) : 0;
  }

  async update(id: number, project: Partial<ProjectCreate>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    const allowedKeys = new Set([
      "title",
      "type",
      "url",
      "short_description",
      "long_description",
      "project_link",
      "categories",
      "stack",
      "highlights",
      "display_order",
    ]);

    for (const [key, value] of Object.entries(project)) {
      if (!allowedKeys.has(key)) continue;
      fields.push(`${key}=?`);
      values.push(
        key === "categories" || key === "stack" || key === "highlights"
          ? serializeJsonStringArray(value as string[] | undefined)
          : value,
      );
    }

    if (!fields.length) return;

    const query = `UPDATE Projects SET ${fields.join(", ")} WHERE id=?`;

    await this.db
      .prepare(query)
      .bind(...values, id)
      .run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare(`DELETE FROM Projects WHERE id=?`).bind(id).run();
  }
}
