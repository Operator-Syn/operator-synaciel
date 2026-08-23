import type { D1Database } from "@cloudflare/workers-types";

export type ProjectMediaType = "video" | "image";

export interface ProjectArchiveGalleryItem {
  id: number;
  project_id: number;
  type: ProjectMediaType;
  url: string;
  display_order: number;
}

export interface ProjectArchiveProject {
  id: number;
  title: string;
  type: ProjectMediaType;
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number;
  created_at: string;
  gallery: ProjectArchiveGalleryItem[];
}

export interface ProjectCursor {
  display_order: number;
  id: number;
}

export interface ProjectArchivePage {
  projects: ProjectArchiveProject[];
  total: number;
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
}

interface ProjectRow {
  id: number;
  title: string;
  type: string;
  url: string;
  short_description: string;
  long_description: string;
  project_link: string;
  display_order: number | null;
  created_at: string | null;
}

interface GalleryRow {
  id: number;
  project_id: number;
  type: string;
  url: string;
  display_order: number | null;
}

const CURSOR_VERSION = 1;

function toBase64Url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
}

export function encodeProjectCursor(cursor: ProjectCursor) {
  return toBase64Url(
    JSON.stringify({
      v: CURSOR_VERSION,
      order: cursor.display_order,
      id: cursor.id,
    }),
  );
}

export function decodeProjectCursor(value: string): ProjectCursor | null {
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as {
      v?: unknown;
      order?: unknown;
      id?: unknown;
    };

    if (
      parsed.v !== CURSOR_VERSION ||
      !Number.isSafeInteger(parsed.order) ||
      !Number.isSafeInteger(parsed.id) ||
      Number(parsed.id) <= 0
    ) {
      return null;
    }

    return {
      display_order: Number(parsed.order),
      id: Number(parsed.id),
    };
  } catch {
    return null;
  }
}

function normalizeDisplayOrder(value: number | null) {
  return Number.isInteger(value) ? Number(value) : 0;
}

function normalizeMediaType(value: string): ProjectMediaType {
  return value === "video" ? "video" : "image";
}

function toProject(row: ProjectRow): ProjectArchiveProject {
  return {
    id: Number(row.id),
    title: String(row.title),
    type: normalizeMediaType(row.type),
    url: String(row.url),
    short_description: String(row.short_description),
    long_description: String(row.long_description),
    project_link: String(row.project_link),
    display_order: normalizeDisplayOrder(row.display_order),
    created_at: row.created_at ? String(row.created_at) : "",
    gallery: [],
  };
}

function toGalleryItem(row: GalleryRow): ProjectArchiveGalleryItem {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    type: normalizeMediaType(row.type),
    url: String(row.url),
    display_order: normalizeDisplayOrder(row.display_order),
  };
}

export class ProjectsPageModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getPage(options: {
    limit: number;
    cursor: ProjectCursor | null;
  }): Promise<ProjectArchivePage> {
    const { limit, cursor } = options;
    const boundary = cursor
      ? `WHERE (COALESCE(p.display_order, 0) > ?
          OR (COALESCE(p.display_order, 0) = ? AND p.id > ?))`
      : "";
    const pageBindings = cursor
      ? [cursor.display_order, cursor.display_order, cursor.id, limit + 1]
      : [limit + 1];

    const [projectResult, totalResult] = await Promise.all([
      this.db
        .prepare(`
          SELECT
            p.id,
            p.title,
            p.type,
            p.url,
            p.short_description,
            p.long_description,
            p.project_link,
            COALESCE(p.display_order, 0) AS display_order,
            p.created_at
          FROM Projects p
          ${boundary}
          ORDER BY COALESCE(p.display_order, 0) ASC, p.id ASC
          LIMIT ?
        `)
        .bind(...pageBindings)
        .all<ProjectRow>(),
      this.db.prepare("SELECT COUNT(*) AS total FROM Projects").first<{ total: number }>(),
    ]);

    const rows = projectResult.results ?? [];
    const hasMore = rows.length > limit;
    const projects = rows.slice(0, limit).map(toProject);

    if (projects.length > 0) {
      const projectIds = projects.map((project) => project.id);
      const placeholders = projectIds.map(() => "?").join(", ");
      const galleryResult = await this.db
        .prepare(`
          SELECT id, project_id, type, url, display_order
          FROM GalleryItems
          WHERE project_id IN (${placeholders})
          ORDER BY project_id ASC, COALESCE(display_order, 0) ASC, id ASC
        `)
        .bind(...projectIds)
        .all<GalleryRow>();

      const galleries = new Map<number, ProjectArchiveGalleryItem[]>();
      for (const row of galleryResult.results ?? []) {
        const item = toGalleryItem(row);
        const projectGallery = galleries.get(item.project_id) ?? [];
        projectGallery.push(item);
        galleries.set(item.project_id, projectGallery);
      }

      for (const project of projects) {
        project.gallery = galleries.get(project.id) ?? [];
      }
    }

    const lastProject = projects.at(-1);

    return {
      projects,
      total: Number(totalResult?.total ?? 0),
      limit,
      has_more: hasMore,
      next_cursor:
        hasMore && lastProject
          ? encodeProjectCursor({
              display_order: lastProject.display_order,
              id: lastProject.id,
            })
          : null,
    };
  }
}
