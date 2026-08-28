import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearVerificationCache,
  runVerificationProfile,
} from "../../tools/repository-mcp/src/verification.ts";

test("mcp-fast verification is fixed and cacheable", () => {
  clearVerificationCache();
  const first = runVerificationProfile("mcp-fast");
  assert.equal(first.passed, true);
  assert.deepEqual(
    first.checks.map((check) => check.check),
    ["mcp_config_check", "mcp_typecheck"],
  );
  assert.equal(first.cached, false);

  const second = runVerificationProfile("mcp-fast");
  assert.equal(second.passed, true);
  assert.equal(second.cached, true);
  assert.deepEqual(second.checks, first.checks);

  assert.throws(
    () => runVerificationProfile("mcp-fast", ["mcp_test"]),
    /not allowed by the mcp-fast profile/,
  );
});
