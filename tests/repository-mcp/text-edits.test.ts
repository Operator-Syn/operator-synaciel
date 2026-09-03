import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { applyExactReplacements } from "../../tools/repository-mcp/src/text-edits.ts";

describe("exact repository text edits", () => {
  test("replaces one exact anchor and preserves surrounding text", () => {
    const result = applyExactReplacements("before\nold\nafter\n", [
      { oldText: "old", newText: "new" },
    ]);

    assert.deepEqual(result, { ok: true, content: "before\nnew\nafter\n" });
  });

  test("deletes an exact line while preserving the file newline style", () => {
    const result = applyExactReplacements("first\r\nremove\r\nlast\r\n", [
      { oldText: "remove\r\n", newText: "" },
    ]);

    assert.deepEqual(result, { ok: true, content: "first\r\nlast\r\n" });
  });

  test("applies multiple non-overlapping replacements against the original snapshot", () => {
    const result = applyExactReplacements("alpha beta gamma", [
      { oldText: "alpha", newText: "A" },
      { oldText: "gamma", newText: "G" },
    ]);

    assert.deepEqual(result, { ok: true, content: "A beta G" });
  });

  test("rejects missing, ambiguous, and overlapping anchors", () => {
    assert.equal(applyExactReplacements("one", [{ oldText: "missing", newText: "x" }]).ok, false);
    assert.equal(
      applyExactReplacements("same same", [{ oldText: "same", newText: "x" }]).ok,
      false,
    );
    assert.equal(
      applyExactReplacements("abcdef", [
        { oldText: "abc", newText: "x" },
        { oldText: "cde", newText: "y" },
      ]).ok,
      false,
    );
  });

  test("does not normalize Unicode or treat a no-op as a different edit", () => {
    const source = "naïve café";
    const result = applyExactReplacements(source, [{ oldText: "café", newText: "café" }]);

    assert.deepEqual(result, { ok: true, content: source });
  });
});
