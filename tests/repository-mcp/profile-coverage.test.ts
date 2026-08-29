import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import {
  isProfilePathAllowed,
  REPOSITORY_WRITE_PROFILES,
} from "../../tools/repository-mcp/src/policy.ts";

const repositoryRoot = new URL("../../", import.meta.url);

function trackedPaths(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

test("the broad repository profile covers every tracked workspace path", () => {
  const paths = trackedPaths();
  assert.ok(paths.length > 0);
  const uncovered = paths.filter((path) => !isProfilePathAllowed("repository", path));
  assert.deepEqual(uncovered, []);
  assert.ok(REPOSITORY_WRITE_PROFILES.repository.prefixes.includes("workers/"));
  assert.ok(REPOSITORY_WRITE_PROFILES.repository.prefixes.includes("apps/"));
  assert.ok(REPOSITORY_WRITE_PROFILES.repository.prefixes.includes("tools/"));
  assert.ok(REPOSITORY_WRITE_PROFILES.repository.prefixes.includes("tests/"));
  assert.ok(REPOSITORY_WRITE_PROFILES.repository.prefixes.includes(".github/"));
});

test("focused profiles remain bounded while repository spans refactored boundaries", () => {
  assert.equal(isProfilePathAllowed("mcp", "workers/portfolio-api/src/entrypoint.ts"), false);
  assert.equal(isProfilePathAllowed("mcp", "apps/portfolio-web/src/data/portfolioMcp.ts"), false);
  assert.equal(isProfilePathAllowed("database", "workers/portfolio-api/src/db/schema.ts"), true);
  assert.equal(isProfilePathAllowed("database", "workers/portfolio-api/src/entrypoint.ts"), false);
  assert.equal(isProfilePathAllowed("repository", "workers/portfolio-api/src/entrypoint.ts"), true);
  assert.equal(isProfilePathAllowed("repository", "graphify-out/graph.json"), false);
  assert.equal(isProfilePathAllowed("repository", ".env"), false);
});
