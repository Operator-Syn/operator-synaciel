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
