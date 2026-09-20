import assert from "node:assert/strict";
import { test } from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import app from "../../workers/portfolio-api/src/entrypoint.ts";

function createDatabase() {
  const settings = [
    { key: "headerPhrase", value: "Calm Interfaces — Welcome Visitors!" },
    { key: "profileImage", value: "https://example.com/profile-256.webp" },
    { key: "status", value: "Available" },
    { key: "internal_setting", value: "must not leak" },
  ];
  const profile = [{ label: "Name", value: "Operator-Syn" }];
  const sections = [
    {
      id: 1,
      title: "Know more about me",
      section_type: "pitch",
      label: null,
      content: "A short pitch.",
      image_url: null,
      target_url: null,
    },
    {
      id: 2,
      title: "Tools",
      section_type: "loadout",
      label: "TypeScript",
      content: null,
      image_url: "https://img.shields.io/badge/TypeScript",
      target_url: null,
    },
  ];
  const projects = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    title: `Project ${index + 1}`,
    type: "image" as const,
    short_description: "Short description",
    project_link: "https://example.com/project",
    display_order: index + 1,
  }));
  const queries: string[] = [];

  const database = {
    prepare(sql: string) {
      queries.push(sql);
      const rows = sql.includes("site_settings")
        ? settings
        : sql.includes("profile_info")
          ? profile
          : sql.includes("FROM sections")
            ? sections
            : projects;
      return {
        all: async <T>() => ({ results: rows as T[] }),
        bind: (...values: unknown[]) => ({
          all: async <T>() => ({
            results: settings.filter((row) => values.includes(row.key)) as T[],
          }),
        }),
      };
    },
  } as unknown as D1Database;

  return { database, queries };
}

async function request(database: D1Database, path: string) {
  return app.fetch(
    new Request(`https://personal-portfolio.syn-forge.com${path}`, {
      headers: { Origin: "https://syn-forge.com" },
    }),
    { DB: database } as never,
  );
}

test("homepage aggregate returns cacheable public data with three projects", async () => {
  const fixture = createDatabase();
  const response = await request(fixture.database, "/api/home");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, s-maxage=300");

  const payload = (await response.json()) as {
    site: Record<string, string>;
    profile: Array<{ label: string }>;
    sections: Array<{ items: unknown[] }>;
    projects: Array<{ id: number }>;
  };
  assert.equal(payload.site.internal_setting, undefined);
  assert.deepEqual(payload.profile, [{ label: "Name", value: "Operator-Syn" }]);
  assert.equal(payload.sections.length, 2);
  assert.equal(payload.sections[0]?.items.length, 1);
  assert.deepEqual(
    payload.projects.map((project) => project.id),
    [1, 2, 3],
  );
  assert.equal(fixture.queries.length, 4);
  assert.ok(fixture.queries.some((query) => /LIMIT 3/.test(query)));
});

test("individual public settings keep no-store behavior", async () => {
  const fixture = createDatabase();
  const response = await request(fixture.database, "/api/settings");

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
});
