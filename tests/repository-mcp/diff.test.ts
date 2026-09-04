import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDiffDocument,
  readDiffChunk,
  renderDiffDocument,
} from "../../tools/repository-mcp/src/diff.ts";
import {
  MAX_DIFF_CHUNK_CHARACTERS,
  MAX_DIFF_STORAGE_CHARACTERS,
} from "../../tools/repository-mcp/src/policy.ts";

test("rejects review diffs beyond the storage ceiling", () => {
  assert.throws(
    () =>
      buildDiffDocument([
        {
          path: "apps/portfolio-web/src/large.ts",
          content: "x".repeat(MAX_DIFF_STORAGE_CHARACTERS + 1),
        },
      ]),
    /storage limit/,
  );
});

test("validates diff chunk bounds and preserves omitted paths", () => {
  const document = buildDiffDocument([
    { path: "first.ts", content: "first\n" },
    { path: "second.ts", content: "second\n" },
  ]);
  const chunk = readDiffChunk(document, 0, 5);
  assert.equal(chunk.content, "first");
  assert.equal(chunk.nextOffset, 5);
  assert.deepEqual(chunk.omittedPaths, ["first.ts", "second.ts"]);
  assert.throws(() => readDiffChunk(document, -1, 5), /offset/);
  assert.throws(() => readDiffChunk(document, 0, MAX_DIFF_CHUNK_CHARACTERS + 1), /maxChars/);
});

test("renders the complete reviewed diff consistently for integrity hashing", () => {
  const document = buildDiffDocument([
    { path: "first.ts", before: "before\n", after: "after\n" },
    { path: "second.ts", content: "created\n" },
  ]);

  const rendered = renderDiffDocument(document);
  assert.match(rendered, /first\.ts/);
  assert.match(rendered, /created/);
});
