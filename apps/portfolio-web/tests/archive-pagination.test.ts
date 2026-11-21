import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldShowArchivePagination } from "../src/components/pages/archivePagination";

/**
 * The controls carry the only Previous affordance. They are hidden exactly when
 * they have nothing to do: one page of results, still on the first page.
 */

test("hides the controls while the whole archive fits on one page", () => {
  assert.equal(shouldShowArchivePagination(false, 1), false);
});

test("shows the controls when another page exists", () => {
  assert.equal(shouldShowArchivePagination(true, 1), true);
});

test("keeps the controls after paging back from the last page", () => {
  // The last page reports no next page, but the visitor still needs Previous.
  assert.equal(shouldShowArchivePagination(false, 2), true);
});

test("shows the controls on any page beyond the first, regardless of hasMore", () => {
  assert.equal(shouldShowArchivePagination(true, 3), true);
});
