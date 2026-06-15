// src/model/ProjectsPageModel.ts
import { D1Database } from "@cloudflare/workers-types";

// Raw row shape returned from the JOIN query
interface ProjectJoinRow {
  // Project fields
  id: number;
  title: string;
  type: 'video' | 'image'; 
  url: string;             
  short_description: string;
  long_description: string;
  project_link: string;
  created_at: string;
  
  // Gallery fields
  gallery_type: 'video' | 'image' | null;
  gallery_url: string | null;
}

// The clean output structure
interface Project {
  id: number;
  title: string;
  thumbnail: {
    type: 'video' | 'image';
    url: string;
  };
  description: {
    short: string;
    long: string;
  };
  link: string;
  gallery: Array<{
    type: 'video' | 'image';
    url: string;
  }>;
}

export class ProjectsPageModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getAllProjects() {
    // UPDATED QUERY: 
    // Changed ORDER BY to use 'p.display_order ASC'
    const query = `
      SELECT 
        p.id, p.title, p.type, p.url, 
        p.short_description, p.long_description, p.project_link, p.created_at,
        g.type as gallery_type, g.url as gallery_url
      FROM Projects p
      LEFT JOIN GalleryItems g ON p.id = g.project_id
      ORDER BY p.display_order ASC, p.id ASC, g.display_order ASC, g.id ASC
    `;

    const { results } = await this.db.prepare(query).all<ProjectJoinRow>();

    return this.transformProjects(results);
  }

  private transformProjects(rows: ProjectJoinRow[]): Project[] {
    const projectsMap = new Map<number, Project>();

    for (const row of rows) {
      // 1. If project not in map yet, initialize it
      // Because SQL sorts by display_order, projects are inserted into the Map in the correct order.
      if (!projectsMap.has(row.id)) {
        projectsMap.set(row.id, {
          id: row.id,
          title: row.title,
          thumbnail: {
            type: row.type,
            url: row.url
          },
          description: {
            short: row.short_description,
            long: row.long_description
          },
          link: row.project_link,
          gallery: [] 
        });
      }

      // 2. If this row has valid gallery data, add it to the project's gallery
      if (row.gallery_url && row.gallery_type) {
        const project = projectsMap.get(row.id)!;
        project.gallery.push({
          type: row.gallery_type,
          url: row.gallery_url
        });
      }
    }

    // Convert Map values back to an Array
    return Array.from(projectsMap.values());
  }
}
