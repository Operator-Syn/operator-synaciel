import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeCertificateCursor,
  encodeCertificateCursor,
} from "../../workers/portfolio-api/src/model/CertificatesPageModel.ts";

test("certificate cursors round-trip the stable display order and id", () => {
  const cursor = { display_order: 6, id: 41 };
  const encoded = encodeCertificateCursor(cursor);

  assert.notEqual(encoded, JSON.stringify(cursor));
  assert.deepEqual(decodeCertificateCursor(encoded), cursor);
});

test("certificate cursors reject malformed, outdated, and unsafe values", () => {
  assert.equal(decodeCertificateCursor("not-a-cursor"), null);

  const outdated = btoa(JSON.stringify({ v: 0, order: 1, id: 2 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(decodeCertificateCursor(outdated), null);

  const invalidId = btoa(JSON.stringify({ v: 1, order: 1, id: 0 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(decodeCertificateCursor(invalidId), null);
});
