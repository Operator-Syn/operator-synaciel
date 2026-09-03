import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  createRepositoryReadPermissionStore,
  type ReadPermissionGrant,
} from "../../tools/repository-mcp/src/read-permissions.ts";
import {
  readRepositoryFiles,
  validateRepositoryReadPath,
} from "../../tools/repository-mcp/src/repository-files.ts";

const allowlistDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    allowlistDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

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
    /is a binary file and cannot be read/,
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
    /Path "package\.json" is not allowed by the app read profile/,
  );
});

test("allows the safe environment template while rejecting live variants", () => {
  assert.equal(validateRepositoryReadPath(".env.example"), ".env.example");
  for (const path of [".env", ".env.local", ".env.production", ".env.example.local"]) {
    assert.throws(
      () => validateRepositoryReadPath(path),
      /sensitive environment or credential file/,
      path,
    );
  }
});

test("uses a temporary exact-path permission once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "operator-synaciel-read-permission-"));
  allowlistDirectories.push(directory);
  const store = createRepositoryReadPermissionStore({
    configPath: join(directory, "read-allowlist.json"),
  });
  const path = "workers/portfolio-api/src/entrypoint.ts";
  const grant = await store.grant("app", [path], "temporary");
  assert.ok(grant.permissionToken);

  const result = await readRepositoryFiles(
    {
      profile: "app",
      files: [{ path }],
      permissionToken: grant.permissionToken,
      maxChars: 64,
    },
    { permissionStore: store },
  );
  assert.equal(result.files[0]?.path, path);

  await assert.rejects(
    readRepositoryFiles(
      { profile: "app", files: [{ path }], permissionToken: grant.permissionToken },
      { permissionStore: store },
    ),
    /Path "workers\/portfolio-api\/src\/entrypoint\.ts" is not allowed by the app read profile/,
  );
});

test("can ask for an inline temporary permission before reading", async () => {
  const directory = await mkdtemp(join(tmpdir(), "operator-synaciel-read-inline-"));
  allowlistDirectories.push(directory);
  const store = createRepositoryReadPermissionStore({
    configPath: join(directory, "read-allowlist.json"),
  });
  const path = "workers/portfolio-api/src/entrypoint.ts";
  let requestedPaths: readonly string[] = [];

  const result = await readRepositoryFiles(
    { profile: "app", files: [{ path }], maxChars: 64 },
    {
      permissionStore: store,
      requestPermission: async (request) => {
        requestedPaths = request.paths;
        return "temporary";
      },
    },
  );
  assert.deepEqual(requestedPaths, [path]);
  assert.equal(result.files[0]?.path, path);
});

test("persists only explicit exact-path permissions outside the checkout", async () => {
  const directory = await mkdtemp(join(tmpdir(), "operator-synaciel-read-allowlist-"));
  allowlistDirectories.push(directory);
  const configPath = join(directory, "read-allowlist.json");
  const store = createRepositoryReadPermissionStore({ configPath });
  const path = "workers/portfolio-api/src/entrypoint.ts";
  const grant: ReadPermissionGrant = await store.grant("app", [path], "permanent");
  assert.equal(grant.permissionToken, undefined);
  assert.equal(await store.isPermanentlyAllowed("app", path), true);
  assert.match(await readFile(configPath, "utf8"), /workers\/portfolio-api\/src\/entrypoint\.ts/);

  const reloadedStore = createRepositoryReadPermissionStore({ configPath });
  assert.equal(await reloadedStore.isPermanentlyAllowed("app", path), true);

  const result = await readRepositoryFiles(
    { profile: "app", files: [{ path }], maxChars: 64 },
    { permissionStore: store },
  );
  assert.equal(result.files[0]?.path, path);
});

test("does not grant sensitive or binary paths through the permission store", async () => {
  const directory = await mkdtemp(join(tmpdir(), "operator-synaciel-read-safe-"));
  allowlistDirectories.push(directory);
  const store = createRepositoryReadPermissionStore({
    configPath: join(directory, "read-allowlist.json"),
  });

  const templateGrant = await store.grant("repository", [".env.example"], "permanent");
  assert.deepEqual(templateGrant.paths, [".env.example"]);
  assert.equal(await store.isPermanentlyAllowed("repository", ".env.example"), true);

  await assert.rejects(
    store.grant("app", ["workers/portfolio-api/.env"], "temporary"),
    /No safe repository paths were provided/,
  );
  await assert.rejects(
    store.grant("app", ["workers/portfolio-api/public/logo.png"], "permanent"),
    /No safe repository paths were provided/,
  );
});
