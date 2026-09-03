import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeploymentInvocation,
  buildMigrationInvocation,
  deployPublicAuth,
  shouldApplyMigration,
} from "../../scripts/deploy-public-auth.mjs";

test("builds a remote public-auth migration invocation with one affirmative answer", () => {
  assert.deepEqual(buildMigrationInvocation(), {
    args: [
      "d1",
      "migrations",
      "apply",
      "portfolio-agent-auth",
      "--remote",
      "--config",
      "workers/portfolio-public-auth/wrangler.toml",
    ],
    input: "y\n",
  });
});

test("does not apply migrations during a dry run or explicit skip", () => {
  assert.equal(shouldApplyMigration([]), true);
  assert.equal(shouldApplyMigration(["--dry-run"]), false);
  assert.equal(shouldApplyMigration(["--skip-migration"]), false);
  assert.equal(shouldApplyMigration(["--migrate-only"]), false);

  const dryRun = buildDeploymentInvocation(["--dry-run"]);
  assert.deepEqual(dryRun.args, [
    "deploy",
    "--env=",
    "--config",
    "workers/portfolio-public-auth/wrangler.toml",
    "--dry-run",
  ]);
  assert.deepEqual(buildDeploymentInvocation(["--skip-migration"]).args, [
    "deploy",
    "--env=",
    "--config",
    "workers/portfolio-public-auth/wrangler.toml",
  ]);
});

test("runs migration before a normal public-auth deploy", async () => {
  const invocations: Array<{ args: readonly string[]; input: string }> = [];
  await deployPublicAuth([], async (invocation) => {
    invocations.push(invocation);
  });

  assert.equal(invocations.length, 2);
  assert.deepEqual(invocations[0], buildMigrationInvocation());
  assert.deepEqual(invocations[1], {
    ...buildDeploymentInvocation([]),
    input: "",
  });
});

test("runs only the migration for the migration-only alias", async () => {
  const invocations: Array<{ args: readonly string[]; input: string }> = [];
  await deployPublicAuth(["--migrate-only"], async (invocation) => {
    invocations.push(invocation);
  });

  assert.deepEqual(invocations, [buildMigrationInvocation()]);
});

test("keeps a dry-run deploy non-mutating", async () => {
  const invocations: Array<{ args: readonly string[]; input: string }> = [];
  await deployPublicAuth(["--dry-run"], async (invocation) => {
    invocations.push(invocation);
  });

  assert.deepEqual(invocations, [{ ...buildDeploymentInvocation(["--dry-run"]), input: "" }]);
});

test("does not deploy when migration application fails", async () => {
  const invocations: Array<{ args: readonly string[]; input: string }> = [];
  await assert.rejects(
    deployPublicAuth([], async (invocation) => {
      invocations.push(invocation);
      throw new Error("migration failed");
    }),
    /migration failed/,
  );

  assert.deepEqual(invocations, [buildMigrationInvocation()]);
});
