import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  collectSnippetFolderPaths,
  decideSnippetFolderRoute,
  hasSnippetFolder,
  parseSnippetFolderSegments,
} from "../functions/snippetFolders.ts";

const tree = [
  {
    id: 23,
    name: "Database Practices",
    type: "dir",
    children: [{ id: 22, name: "Database Migrations.md", type: "file" }],
  },
  {
    id: 4,
    name: "Dummy Folder",
    type: "dir",
    children: [
      { id: 3, name: "README.md", type: "file" },
      { id: 24, name: "XQubit Handbook.pdf", type: "file" },
    ],
  },
  {
    id: 5,
    name: "Nested",
    type: "dir",
    children: [{ id: 6, name: "Child", type: "dir", children: [] }],
  },
];

test("parses real, legacy, and document snippet paths", () => {
  assert.deepEqual(parseSnippetFolderSegments("/snippets/Database%20Practices"), [
    "Database Practices",
  ]);
  assert.deepEqual(parseSnippetFolderSegments("/snippets/Database%20Practices/"), [
    "Database Practices",
  ]);
  assert.deepEqual(parseSnippetFolderSegments("/snippets/Dummy%20Folder/"), ["Dummy Folder"]);
  assert.deepEqual(parseSnippetFolderSegments("/snippets/root/database/migrations/"), [
    "database",
    "migrations",
  ]);
  assert.deepEqual(parseSnippetFolderSegments("/snippets/root/Child"), ["Child"]);
  assert.deepEqual(parseSnippetFolderSegments("/snippets/rooted/Child"), ["rooted", "Child"]);
  assert.equal(parseSnippetFolderSegments("/snippets/document/22/database-migrations.md"), null);
  assert.equal(parseSnippetFolderSegments("/snippets/document/999/fake"), null);
  assert.equal(parseSnippetFolderSegments("/snippets"), null);
  assert.equal(parseSnippetFolderSegments("/snippets/"), null);
  assert.equal(parseSnippetFolderSegments("/snippets/root"), null);
  assert.equal(parseSnippetFolderSegments("/snippets/root/"), null);
  assert.equal(parseSnippetFolderSegments("/projects"), null);
});

test("collects only directory paths from the snippet tree", () => {
  const folders = collectSnippetFolderPaths(tree);

  assert.equal(hasSnippetFolder(folders, ["Database Practices"]), true);
  assert.equal(hasSnippetFolder(folders, ["Dummy Folder"]), true);
  assert.equal(hasSnippetFolder(folders, ["Nested"]), true);
  assert.equal(hasSnippetFolder(folders, ["Nested", "Child"]), true);

  assert.equal(hasSnippetFolder(folders, ["invented-xyz"]), false);
  assert.equal(hasSnippetFolder(folders, ["Database Practices", "Database Migrations.md"]), false);
  assert.equal(hasSnippetFolder(folders, ["root", "database", "migrations"]), false);
});

test("decides serve, 404, and no-slash redirect for snippet folders", () => {
  const folders = collectSnippetFolderPaths(tree);

  assert.deepEqual(
    decideSnippetFolderRoute("/snippets/Database%20Practices", ["Database Practices"], folders),
    { action: "serve" },
  );
  assert.deepEqual(
    decideSnippetFolderRoute("/snippets/Database%20Practices/", ["Database Practices"], folders),
    { action: "redirect", pathname: "/snippets/Database%20Practices" },
  );
  assert.deepEqual(decideSnippetFolderRoute("/snippets/invented-xyz", ["invented-xyz"], folders), {
    action: "not-found",
  });
  assert.deepEqual(decideSnippetFolderRoute("/snippets/invented-xyz/", ["invented-xyz"], folders), {
    action: "not-found",
  });
  assert.deepEqual(
    decideSnippetFolderRoute("/snippets/Database%20Practices", ["Database Practices"], undefined),
    { action: "serve" },
  );
  assert.deepEqual(decideSnippetFolderRoute("/snippets", null, folders), { action: "serve" });
});

test("rejects malformed snippet trees instead of inventing folder paths", () => {
  assert.throws(() => collectSnippetFolderPaths({}));
  assert.throws(() => collectSnippetFolderPaths([{ id: 1, name: 1, type: "dir" }]));
  assert.throws(() => collectSnippetFolderPaths([{ id: 1, name: "Folder", type: "link" }]));
});

test("middleware consults the folder existence check", async () => {
  const middleware = await readFile(
    new URL("../functions/_middleware.ts", import.meta.url),
    "utf8",
  );

  assert.match(middleware, /parseSnippetFolderSegments\(pathname\)/);
  assert.match(middleware, /lookupSnippetFolders\(context\.env\.VITE_API_URL\)/);
  assert.match(middleware, /resolveSnippetFolderRoute\(\s*pathname,\s*folderSegments,/);
  assert.match(middleware, /probeSnippetFolder\(context\.env\.SNIPPET_DB, segments\)/);
  assert.match(middleware, /decision\.action === "not-found"/);
  assert.match(middleware, /decision\.action === "redirect"/);
});
