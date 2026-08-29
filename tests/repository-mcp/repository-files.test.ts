import assert from "node:assert/strict";
import { test } from "node:test";

import { readRepositoryFiles } from "../../tools/repository-mcp/src/repository-files.ts";

test("reads bounded source snapshots in a batch", async () => {
  const first = await readRepositoryFiles({
    profile: "mcp",
    files: [
      { path: "tools/repository-mcp/src/policy.ts", offset: 0 },
      { path: "tools/repository-mcp/src/path.ts", offset: 0 },
    ],
    maxChars: 32,
  });
  assert.equal(first.kind, "repository-files");
  assert.equal(first.files.length, 2);
  assert.equal(first.files[0]?.offset, 0);
  assert.equal(first.files[0]?.content.length, 32);
  assert.equal(first.files[0]?.nextOffset, 32);
  assert.equal(first.files[0]?.complete, false);
  assert.equal(typeof first.files[0]?.sha256, "string");
  assert.equal(first.files[0]?.totalBytes > 0, true);
  assert.equal(first.omittedPaths.length, 0);

  const next = await readRepositoryFiles({
    profile: "mcp",
    files: [{ path: "tools/repository-mcp/src/policy.ts", offset: 32 }],
    maxChars: 32,
  });
  assert.equal(next.files[0]?.offset, 32);
  assert.equal(next.files[0]?.content.length, 32);
  assert.equal(next.files[0]?.nextOffset, 64);
});

test("reads cross-workspace source through the repository profile", async () => {
  const result = await readRepositoryFiles({
    profile: "repository",
    files: [
      { path: "workers/portfolio-api/src/entrypoint.ts" },
      { path: "workers/portfolio-mcp/src/mcp/server.ts" },
      { path: "apps/portfolio-web/src/data/portfolioMcp.ts" },
      { path: "package-lock.json" },
    ],
    maxChars: 128,
  });
  assert.equal(result.profile, "repository");
  assert.equal(result.files.length, 4);
  for (const file of result.files) {
    assert.equal(file.exists, true, file.path);
    assert.equal(file.content.length, 128);
    assert.equal(typeof file.sha256, "string");
  }
  const packageLock = result.files.find((file) => file.path === "package-lock.json");
  assert.ok(packageLock);
  assert.equal(packageLock.totalBytes > 512_000, true);
  assert.equal(packageLock.complete, false);
  assert.equal(packageLock.nextOffset, 128);
});

test("rejects binary and ignored paths from the broad source profile", async () => {
  await assert.rejects(
    readRepositoryFiles({
      profile: "repository",
      files: [{ path: "apps/portfolio-web/public/social-image.png" }],
    }),
    /Binary file paths cannot be read/,
  );
  await assert.rejects(
    readRepositoryFiles({
      profile: "repository",
      files: [{ path: "graphify-out/graph.json" }],
    }),
    /ignored runtime directory/,
  );
});

test("rejects duplicate and out-of-profile source requests", async () => {
  await assert.rejects(
    readRepositoryFiles({
      profile: "mcp",
      files: [
        { path: "tools/repository-mcp/src/policy.ts" },
        { path: "tools/repository-mcp/src/policy.ts" },
      ],
    }),
    /Duplicate repository file paths/,
  );
  await assert.rejects(
    readRepositoryFiles({ profile: "app", files: [{ path: "package.json" }] }),
    /not allowed by the app read profile/,
  );
});
