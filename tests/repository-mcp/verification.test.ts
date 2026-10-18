import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REPOSITORY_VERIFICATION_PROFILES,
  SAFE_VERIFICATION_COMMANDS,
} from "../../tools/repository-mcp/src/policy.ts";
import {
  boundVerificationOutput,
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

test("verification output stays within the published schema limit", () => {
  const short = boundVerificationOutput("ok", "");
  assert.equal(short, "ok");

  const oversized = boundVerificationOutput("x".repeat(20_000), "");
  assert.equal(oversized.length, 12_000);
  assert.match(oversized, /\[output truncated\]$/);

  const combined = boundVerificationOutput("x".repeat(20_000), "stderr tail");
  assert.equal(combined.length, 12_000);
  assert.match(combined, /\[output truncated\]$/);
});

test("repository verification covers all fixed workspace checks", () => {
  const checks = [...REPOSITORY_VERIFICATION_PROFILES.repository];
  assert.deepEqual(checks, [
    "docs_check",
    "skills_check",
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "portfolio_mcp_typecheck",
    "portfolio_mcp_test",
    "api_typecheck",
    "api_test",
    "web_test",
    "db_migration_check",
    "migration_list_local",
    "typecheck",
    "lint",
    "biome_check",
    "build",
  ]);
  for (const check of checks) {
    assert.ok(SAFE_VERIFICATION_COMMANDS[check]);
  }
  assert.deepEqual(REPOSITORY_VERIFICATION_PROFILES.full, checks);
});
