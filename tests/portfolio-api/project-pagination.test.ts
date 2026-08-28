import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeProjectCursor,
  encodeProjectCursor,
} from "../../workers/portfolio-api/src/model/ProjectsPageModel.ts";

test("project cursors round-trip the stable display order and id", () => {
  const cursor = { display_order: 4, id: 27 };
  const encoded = encodeProjectCursor(cursor);

  assert.notEqual(encoded, JSON.stringify(cursor));
  assert.deepEqual(decodeProjectCursor(encoded), cursor);
});

test("project cursors reject malformed, outdated, and unsafe values", () => {
  assert.equal(decodeProjectCursor("not-a-cursor"), null);

  const outdated = btoa(JSON.stringify({ v: 0, order: 1, id: 2 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(decodeProjectCursor(outdated), null);

  const invalidId = btoa(JSON.stringify({ v: 1, order: 1, id: 0 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(decodeProjectCursor(invalidId), null);
});
