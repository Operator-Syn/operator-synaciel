import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectSnippetDocuments,
  type SnippetNode,
} from "../src/components/pages/snippetsPage/snippetDocuments";

function file(id: number, name: string, format: "md" | "pdf" = "md"): SnippetNode {
  return { id, name, type: "file", modified: "2026-06-11", format };
}

function folder(name: string, children: SnippetNode[]): SnippetNode {
  return { id: -1, name, type: "dir", modified: "2026-06-11", children };
}

/**
 * The index lists the documents it can reach by walking folders, so the
 * collector must see nested leaves in tree order and keep their paths.
 */

test("returns the leaves of a flat root", () => {
  const documents = collectSnippetDocuments([file(1, "a.md"), file(2, "b.pdf", "pdf")]);

  assert.deepEqual(documents, [
    { id: 1, name: "a.md", path: "a.md" },
    { id: 2, name: "b.pdf", path: "b.pdf" },
  ]);
});

test("carries the folder path onto nested documents", () => {
  const documents = collectSnippetDocuments([folder("database", [file(7, "migrations.md")])]);

  assert.deepEqual(documents, [{ id: 7, name: "migrations.md", path: "database/migrations.md" }]);
});

test("walks depth-first in tree order and joins deeper paths", () => {
  const documents = collectSnippetDocuments([
    file(1, "root.md"),
    folder("guides", [file(2, "setup.md"), folder("advanced", [file(3, "tuning.md")])]),
    file(4, "tail.md"),
  ]);

  assert.deepEqual(
    documents.map((document) => document.path),
    ["root.md", "guides/setup.md", "guides/advanced/tuning.md", "tail.md"],
  );
});

test("skips folders without children and returns an empty list for an empty tree", () => {
  assert.deepEqual(collectSnippetDocuments([]), []);
  assert.deepEqual(collectSnippetDocuments([{ ...folder("empty", []), children: undefined }]), []);
});
