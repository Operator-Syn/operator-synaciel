// workers/portfolio-api/src/model/HomePageModel.ts
import type { D1Database } from "@cloudflare/workers-types";

interface SettingRow {
  key: string;
  value: string;
}

interface ProfileRow {
  label: string;
  value: string;
}

interface SectionJoinedRow {
  id: number;
  title: string;
  section_type: string;
  label: string | null;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
}

interface HomePageSection {
  id: number;
  title: string;
  section_type: string;
  items: Array<{
    content: string | null;
    image_url: string | null;
    label: string | null;
    target_url: string | null;
  }>;
}

interface ProjectRow {
  id: number;
  title: string;
  type: "video" | "image";
  short_description: string;
  project_link: string;
  display_order: number;
}

const PUBLIC_SETTING_KEYS = [
  "headerPhrase",
  "mobileHeaderPhrase",
  "profileImage",
  "status",
] as const;

export class HomePageModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getHomePageData() {
    const placeholders = PUBLIC_SETTING_KEYS.map(() => "?").join(", ");
    const [settings, profile, rows, projects] = await Promise.all([
      this.db
        .prepare(`SELECT key, value FROM site_settings WHERE key IN (${placeholders})`)
        .bind(...PUBLIC_SETTING_KEYS)
        .all<SettingRow>(),
      this.db
        .prepare("SELECT label, value FROM profile_info ORDER BY display_order, id")
        .all<ProfileRow>(),
      this.db
        .prepare(`
        SELECT s.id, s.title, s.section_type, i.label, i.content, i.image_url, i.target_url
        FROM sections s
        LEFT JOIN section_items i ON s.id = i.section_id
        ORDER BY s.display_order ASC, s.id ASC, i.display_order ASC, i.id ASC
      `)
        .all<SectionJoinedRow>(),
      this.db
        .prepare(
          "SELECT id, title, type, short_description, project_link, display_order FROM Projects ORDER BY display_order ASC, id ASC LIMIT 3",
        )
        .all<ProjectRow>(),
    ]);

    return {
      site: Object.fromEntries(settings.results.map((row) => [row.key, row.value])),
      profile: profile.results,
      sections: this.transformSections(rows.results),
      projects: projects.results.slice(0, 3).map((project) => ({
        id: Number(project.id),
        title: String(project.title),
        type: project.type === "video" ? "video" : "image",
        short_description: String(project.short_description),
        project_link: String(project.project_link),
        display_order: Number(project.display_order),
      })),
    };
  }

  private transformSections(rows: SectionJoinedRow[]): HomePageSection[] {
    const sections = new Map<number, HomePageSection>();

    for (const row of rows) {
      const section = sections.get(row.id) ?? {
        id: Number(row.id),
        title: row.title,
        section_type: row.section_type,
        items: [],
      };

      if (
        row.content !== null ||
        row.image_url !== null ||
        row.label !== null ||
        row.target_url !== null
      ) {
        section.items.push({
          content: row.content,
          image_url: row.image_url,
          label: row.label,
          target_url: row.target_url,
        });
      }

      sections.set(row.id, section);
    }

    return [...sections.values()];
  }
}
