import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseSnippetTimestamp,
  readSnippetPublishedAt,
} from "../functions/snippetDocumentDates.ts";
import type { SnippetDatabase } from "../functions/snippetFolderProbe.ts";

const createdSql = "SELECT created_at FROM Snippets WHERE id = ? AND type = 'file' LIMIT 1";
type Options = { reject?: boolean; malformed?: boolean; empty?: boolean; created?: unknown };

/** Fake D1 that records prepared SQL and bound ids, so query count is assertable. */
function database(options: Options = {}) {
  const statements: string[] = [];
  const bindings: number[][] = [];
  const db: SnippetDatabase = {
    prepare(sql) {
      statements.push(sql);
      function read() {
        if (options.reject) return Promise.reject(new Error("D1 unavailable"));
        if (options.malformed) return Promise.resolve({ success: true, results: ["nope"] });
        if (options.empty) return Promise.resolve({ success: true, results: [] });
        return Promise.resolve({
          success: true,
          results: [{ created_at: options.created ?? "2026-06-11 14:28:59" }],
        });
      }
      return {
        all: read,
        bind: (...ids) => {
          bindings.push(ids);
          return { all: read };
        },
      };
    },
  };
  return { db, statements, bindings };
}

test("normalizes D1 timestamps and rejects unusable values", () => {
  // D1 stores datetime('now') as UTC without a suffix, so the bare form gets `Z`.
  assert.equal(parseSnippetTimestamp("2026-06-11 14:28:59"), "2026-06-11T14:28:59.000Z");
  assert.equal(parseSnippetTimestamp("2026-06-11T14:28:59Z"), "2026-06-11T14:28:59.000Z");
  assert.equal(parseSnippetTimestamp("2026-06-11T14:28:59+02:00"), "2026-06-11T12:28:59.000Z");
  for (const value of [undefined, null, 0, "", "   ", "not a date"]) {
    assert.equal(parseSnippetTimestamp(value), undefined);
  }
});

test("reads the row's created_at as the publication date", async () => {
  const { db, statements, bindings } = database();
  assert.equal(await readSnippetPublishedAt(db, 22), "2026-06-11T14:28:59.000Z");
  assert.deepEqual(statements, [createdSql]);
  assert.deepEqual(bindings, [[22]]);
});

test("skips the query for an absent binding or an unusable id", async () => {
  const { db, statements } = database();
  assert.equal(await readSnippetPublishedAt(undefined, 22), undefined);
  for (const id of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(await readSnippetPublishedAt(db, id), undefined);
  }
  assert.deepEqual(statements, []);
});

test("omits the date when the row, the read, or the value is unusable", async () => {
  assert.equal(await readSnippetPublishedAt(database({ empty: true }).db, 22), undefined);
  assert.equal(await readSnippetPublishedAt(database({ reject: true }).db, 22), undefined);
  assert.equal(await readSnippetPublishedAt(database({ malformed: true }).db, 22), undefined);
  assert.equal(await readSnippetPublishedAt(database({ created: "not a date" }).db, 22), undefined);
});

test("middleware emits article:published_time from the D1 publication date", async () => {
  const middleware = await readFile(
    new URL("../functions/_middleware.ts", import.meta.url),
    "utf8",
  );

  assert.match(middleware, /readSnippetPublishedAt\(db, id\)/);
  assert.match(middleware, /context\.env\.SNIPPET_DB,/);
  assert.match(middleware, /article:published_time/);
  assert.match(middleware, /article:modified_time/);
});
