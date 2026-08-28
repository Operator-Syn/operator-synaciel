import assert from "node:assert/strict";
import { test } from "node:test";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { Context } from "hono";
import type { Bindings } from "../../workers/portfolio-api/src/bindings.ts";
import { SettingsController } from "../../workers/portfolio-api/src/controller/HomePage/SettingsController.ts";
import { SnippetsPageModel } from "../../workers/portfolio-api/src/model/SnippetsPage/SnippetsPageModel.ts";

function createSettingsDatabase() {
  let query = "";
  let boundValues: unknown[] = [];

  const rows = [
    { key: "headerPhrase", value: "Public header" },
    { key: "mobileHeaderPhrase", value: "Public mobile header" },
    { key: "profileImage", value: "https://example.com/profile.png" },
    { key: "status", value: "Available" },
    { key: "internal_setting", value: "not public" },
  ];

  const database = {
    prepare(sql: string) {
      query = sql;

      return {
        async all<T>() {
          return { results: rows as T[] };
        },
        bind(...values: unknown[]) {
          boundValues = values;

          return {
            async all<T>() {
              return {
                results: rows.filter((row) => values.includes(row.key)) as T[],
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return {
    database,
    getQuery: () => query,
    getBoundValues: () => boundValues,
  };
}

test("public settings return only the documented setting allowlist", async () => {
  const fixture = createSettingsDatabase();
  const response = await SettingsController.list({
    env: { DB: fixture.database },
    json(value: unknown) {
      return value;
    },
  } as unknown as Context<{ Bindings: Bindings }>);

  assert.deepEqual(response, {
    headerPhrase: "Public header",
    mobileHeaderPhrase: "Public mobile header",
    profileImage: "https://example.com/profile.png",
    status: "Available",
  });
  assert.match(fixture.getQuery(), /WHERE key IN/);
  assert.deepEqual(fixture.getBoundValues(), [
    "headerPhrase",
    "mobileHeaderPhrase",
    "profileImage",
    "status",
  ]);
});

function createSnippetDatabase() {
  const row = {
    id: 7,
    parent_id: null,
    name: "Agent Notes.md",
    type: "file",
    storage_path: "snippets/Agent Notes.md",
    size_bytes: 42,
    file_format: "md",
    display_order: 2,
    created_at: "2026-08-28T00:00:00.000Z",
    modified_at: "2026-08-28T00:00:00.000Z",
  } as const;

  const database = {
    prepare() {
      return {
        async all<T>() {
          return { results: [row as T] };
        },
        bind() {
          return {
            async first<T>() {
              return row as T;
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return database;
}

test("public snippet reads omit storage paths and ordering metadata", async () => {
  const model = new SnippetsPageModel(createSnippetDatabase(), {} as R2Bucket);
  const expected = {
    id: 7,
    name: "Agent Notes.md",
    type: "file",
    modified: "2026-08-28T00:00:00.000Z",
    size: 42,
    format: "md",
  };

  const tree = await model.getFileTree();
  const item = await model.getSnippetById(7);

  assert.deepEqual(tree, [expected]);
  assert.deepEqual(item, expected);
  assert.ok(item);
  assert.equal("path" in item, false);
  assert.equal("display_order" in item, false);
});
