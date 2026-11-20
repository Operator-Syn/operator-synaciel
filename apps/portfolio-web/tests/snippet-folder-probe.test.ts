import assert from "node:assert/strict";
import test from "node:test";
import {
  folderExists,
  probeSnippetFolder,
  type SnippetDatabase,
} from "../functions/snippetFolderProbe.ts";
import { resolveSnippetFolderRoute } from "../functions/snippetFolders.ts";

const rootSql = "SELECT id, name FROM Snippets WHERE parent_id IS NULL AND type = 'dir'";
const childSql = (count: number) =>
  `SELECT id, name FROM Snippets WHERE parent_id IN (${Array(count).fill("?").join(", ")}) AND type = 'dir'`;
type Row = { id: number; parent: number | null; name: string; type?: "file" };

function database(rows: Row[], options: { rejectAt?: number; malformedAt?: number } = {}) {
  const queries: string[] = [];
  const db: SnippetDatabase = {
    prepare(sql) {
      queries.push(sql);
      const queryNumber = queries.length;
      function read(parents: number[]) {
        if (queryNumber === options.rejectAt) return Promise.reject(new Error("D1 unavailable"));
        if (queryNumber === options.malformedAt) {
          return Promise.resolve({ success: true, results: [{ id: "1", name: "bad" }] });
        }
        assert.equal(sql, parents.length ? childSql(parents.length) : rootSql);
        const results = rows
          .filter(
            (row) =>
              !row.type && (row.parent === null ? !parents.length : parents.includes(row.parent)),
          )
          .map(({ id, name }) => ({ id, name }));
        return Promise.resolve({ success: true, results });
      }
      return { all: () => read([]), bind: (...ids) => ({ all: () => read(ids) }) };
    },
  };
  return { db, queries };
}

// The compiler, not a runtime call with an unchecked array, tests this boundary.
function checkProbeType(db: SnippetDatabase, unchecked: string[]) {
  // @ts-expect-error Unvalidated arrays must enter through the guarded probe.
  return folderExists(db, unchecked);
}
void checkProbeType;

test("keeps duplicate parents and matches trimmed directory names, not files or other case", async () => {
  const { db, queries } = database([
    { id: 1, parent: null, name: "\u00a0Root\u00a0" },
    { id: 2, parent: null, name: "Root" },
    { id: 3, parent: 2, name: "Child" },
    { id: 4, parent: 1, name: "File", type: "file" },
  ]);
  assert.equal(await probeSnippetFolder(db, ["Root", "Child"]), "yes");
  assert.deepEqual(queries, [rootSql, childSql(2)]);
  assert.equal(await probeSnippetFolder(db, ["Root", "File"]), "no");
  const before = queries.length;
  assert.equal(await probeSnippetFolder(db, ["root", "Child"]), "no");
  assert.equal(queries.length, before + 1);
});

test("rejects unsupported paths before preparing SQL", async () => {
  const { db, queries } = database([]);
  for (const segments of [[], [""], [" "], ["one\u0000two"], Array(9).fill("part")]) {
    assert.equal(await probeSnippetFolder(db, segments), "unknown");
  }
  assert.equal(await probeSnippetFolder(undefined, ["Root"]), "unknown");
  assert.deepEqual(queries, []);
});

test("walks exactly eight levels", async () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    parent: i || null,
    name: "part",
  }));
  const { db, queries } = database(rows);
  assert.equal(await probeSnippetFolder(db, Array(8).fill("part")), "yes");
  assert.equal(queries.length, 8);
});

test("checks 90 candidate parents but skips the child query at 91", async () => {
  for (const count of [90, 91]) {
    const roots = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      parent: null,
      name: "Root",
    }));
    const { db, queries } = database([...roots, { id: 100, parent: count, name: "Child" }]);
    assert.equal(await probeSnippetFolder(db, ["Root", "Child"]), count === 90 ? "yes" : "unknown");
    assert.deepEqual(queries, count === 90 ? [rootSql, childSql(90)] : [rootSql]);
  }
});

test("returns unknown for a file-only root and no for an empty child result", async () => {
  const fileOnly = database([{ id: 1, parent: null, name: "Root", type: "file" }]);
  assert.equal(await probeSnippetFolder(fileOnly.db, ["Root"]), "unknown");
  const rootOnly = database([{ id: 1, parent: null, name: "Root" }]);
  assert.equal(await probeSnippetFolder(rootOnly.db, ["Root", "Child"]), "no");
});

test("root and child binding failures or malformed rows use the existing API fallback", async () => {
  for (const options of [
    { rejectAt: 1 },
    { rejectAt: 2 },
    { malformedAt: 1 },
    { malformedAt: 2 },
  ]) {
    const { db } = database([{ id: 1, parent: null, name: "Root" }], options);
    let apiCalls = 0;
    const segments = ["Root", "Child"];
    const decision = await resolveSnippetFolderRoute(
      "/snippets/Root/Child/",
      segments,
      (path) => probeSnippetFolder(db, path),
      async () => {
        apiCalls++;
        return new Set(["Root\u0000Child"]);
      },
    );
    assert.equal(apiCalls, 1);
    assert.deepEqual(decision, { action: "redirect", pathname: "/snippets/Root/Child" });
  }
});

test("definitive answers skip the API", async () => {
  const { db } = database([{ id: 1, parent: null, name: "Root" }]);
  for (const [name, suffix, action] of [
    ["Root", "", "serve"],
    ["Root", "/", "redirect"],
    ["Missing", "", "not-found"],
    ["Missing", "/", "not-found"],
  ] as const) {
    const decision = await resolveSnippetFolderRoute(
      `/snippets/${name}${suffix}`,
      [name],
      (path) => probeSnippetFolder(db, path),
      async () => assert.fail("definitive D1 answer must skip HTTP"),
    );
    assert.equal(decision.action, action);
  }
});

test("non-folder requests skip both lookups; unsupported folders keep legacy decisions", async () => {
  const nonFolder = await resolveSnippetFolderRoute(
    "/snippets",
    null,
    async () => assert.fail("not a folder"),
    async () => assert.fail("not a folder"),
  );
  assert.deepEqual(nonFolder, { action: "serve" });

  const { db, queries } = database([]);
  const segments = Array<string>(9).fill("part");
  for (const [folders, action] of [
    [new Set([segments.join("\u0000")]), "redirect"],
    [new Set<string>(), "not-found"],
    [undefined, "serve"],
  ] as const) {
    let apiCalls = 0;
    const decision = await resolveSnippetFolderRoute(
      `/snippets/${segments.join("/")}/`,
      segments,
      (path) => probeSnippetFolder(db, path),
      async () => {
        apiCalls++;
        return folders;
      },
    );
    assert.equal(decision.action, action);
    assert.equal(apiCalls, 1);
  }
  assert.deepEqual(queries, []);
});
