/**
 * Scroll restoration rules for the archive routes.
 *
 * The bug these cover: on reload the browser restored the saved offset against the loading
 * skeleton, which is shorter than the finished page, so the offset clamped to the document's
 * maximum and the reader landed on the footer. Restoring only after the rows exist — and
 * declining a position that was the very bottom — is what fixes it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  clampScrollOffset,
  isAtDocumentEnd,
  parseSavedScroll,
  resolveScrollRestore,
  scrollStorageKey,
  shouldRestoreOffset,
} from "../src/components/pages/archiveScrollRestoration";

test("keys are namespaced per route", () => {
  assert.equal(scrollStorageKey("/projects"), "archive-scroll:/projects");
  assert.notEqual(scrollStorageKey("/projects"), scrollStorageKey("/certificates"));
});

test("an absent, malformed or negative position is not restored", () => {
  assert.equal(resolveScrollRestore(null, 900), null);
  assert.equal(resolveScrollRestore("banana", 900), null);
  assert.equal(resolveScrollRestore("-40", 900), null);
  assert.equal(resolveScrollRestore("Infinity", 900), null);
});

test("zero means the reader was at the top, so there is nothing to do", () => {
  assert.equal(resolveScrollRestore("0", 900), null);
});

test("a position beyond the document is clamped to what it can scroll", () => {
  assert.equal(resolveScrollRestore("5000", 900), 900);
  assert.equal(resolveScrollRestore("400", 900), 400);
  assert.equal(resolveScrollRestore("400", 0), 0);
});

test("clamping never produces a negative offset", () => {
  assert.equal(clampScrollOffset(-100, 500), 0);
  assert.equal(clampScrollOffset(200, -10), 0);
});

test("the end of the document is recognised within a couple of pixels", () => {
  assert.equal(isAtDocumentEnd(900, 900), true);
  assert.equal(isAtDocumentEnd(899, 900), true);
  assert.equal(isAtDocumentEnd(880, 900), false);
  assert.equal(isAtDocumentEnd(0, 0), false);
});

test("a position saved at the bottom is not restored", () => {
  // The reader was at the footer, not reading the archive; a reload starts at the top.
  assert.equal(shouldRestoreOffset(900, 900), false);
  assert.equal(shouldRestoreOffset(400, 900), true);
  assert.equal(shouldRestoreOffset(null, 900), false);
});

test("a saved position is parsed with the height it was saved at", () => {
  assert.deepEqual(parseSavedScroll('{"y":400,"max":900}'), { y: 400, max: 900 });
  assert.deepEqual(parseSavedScroll('{"y":400}'), { y: 400, max: 0 });
});

test("unusable saved values are rejected rather than trusted", () => {
  assert.equal(parseSavedScroll(null), null);
  assert.equal(parseSavedScroll("not json"), null);
  assert.equal(parseSavedScroll('{"y":"400"}'), null);
  assert.equal(parseSavedScroll('{"y":-1}'), null);
  assert.equal(parseSavedScroll("null"), null);
});
