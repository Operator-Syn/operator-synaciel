// src/model/HomePageModel.ts
import { D1Database } from "@cloudflare/workers-types";

interface SettingRow { key: string; value: string; }
interface ProfileRow { label: string; value: string; }
interface SectionJoinedRow {
  title: string;
  section_type: string;
  label: string | null;
  content: string | null;
  image_url: string | null;
  target_url: string | null;
}

interface HomePagePitchItem {
  title: string;
  content: string;
}

interface HomePageSocialItem {
  label: string | null;
  image_url: string | null;
  target_url: string | null;
}

interface HomePageLoadoutItem {
  category: string;
  badges: string[];
}

interface HomePageSections {
  pitch: { items: HomePagePitchItem[] };
  social: { items: HomePageSocialItem[] };
  loadouts: HomePageLoadoutItem[];
}

export class HomePageModel {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getHomePageData() {
    const [settings, profile, rows] = await Promise.all([
      this.db.prepare("SELECT key, value FROM site_settings").all<SettingRow>(),
      this.db.prepare("SELECT label, value FROM profile_info ORDER BY display_order, id").all<ProfileRow>(),
      this.db.prepare(`
        SELECT s.title, s.section_type, i.label, i.content, i.image_url, i.target_url
        FROM sections s
        LEFT JOIN section_items i ON s.id = i.section_id
        ORDER BY s.display_order ASC, s.id ASC, i.display_order ASC, i.id ASC
      `).all<SectionJoinedRow>()
    ]);

    return {
      site: Object.fromEntries(settings.results.map(r => [r.key, r.value])),
      profile: profile.results,
      sections: this.transformSections(rows.results)
    };
  }

  private transformSections(rows: SectionJoinedRow[]) {
    const data: HomePageSections = {
      pitch: { items: [] },
      social: { items: [] },
      loadouts: []
    };

    rows.forEach(row => {
      switch (row.section_type) {
        case 'pitch':
          if (row.content) {
            data.pitch.items.push({
              title: row.title,
              content: row.content
            });
          }
          break;

        case 'social':
          data.social.items.push({
            label: row.label,
            image_url: row.image_url,
            target_url: row.target_url
          });
          break;

        case 'loadout':
          {
            // Find or create the category (e.g., "Operating Systems")
            let cat = data.loadouts.find((l) => l.category === row.title);
            if (!cat) {
              cat = { category: row.title, badges: [] };
              data.loadouts.push(cat);
            }
            if (row.image_url) cat.badges.push(row.image_url);
          }
          break;
      }
    });

    return data;
  }
}
