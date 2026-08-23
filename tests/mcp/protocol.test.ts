import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  createRepository,
  payload,
  removeRepository,
  repositoryRoot,
  serverEntry,
  startServer,
  tsx,
} from "./support.ts";

const repositories: string[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(repositories.splice(0).map(removeRepository));
});

describe("repository MCP protocol", () => {
  test("initializes and exposes the guarded repository tools", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/list");
    const names = new Set((response.result?.tools ?? []).map((tool) => tool.name));
    assert.deepEqual(
      names,
      new Set([
        "repository_workflow_status",
        "prepare_repository_change",
        "apply_repository_change",
        "verify_repository_change",
        "prepare_working_tree_commit",
        "git_commit_working_tree",
        "prepare_commits",
        "git_commit_files",
      ]),
    );
    assert.match(server.initialization.result?.instructions ?? "", /repository_workflow_status/);
  });

  test("reports workflow readiness without exposing approval or credential values", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const status = payload(
      await server.call("tools/call", {
        name: "repository_workflow_status",
        arguments: {},
      }),
    );
    assert.equal(status.projectRoot, repository);
    assert.equal((status.server as Record<string, unknown>).name, "operator-synaciel-repository");
    assert.equal(
      JSON.stringify(status).includes("OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL"),
      false,
    );
    assert.equal(JSON.stringify(status).includes("secret"), false);
  });

  test("rejects unsafe paths and checks outside a selected verification profile", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const unsafe = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "reject traversal",
          profile: "app",
          operations: [{ path: "../outside.txt", content: "nope\n" }],
        },
      }),
    );
    assert.equal(unsafe.status, "rejected");

    const invalidCheck = payload(
      await server.call("tools/call", {
        name: "verify_repository_change",
        arguments: { profile: "app", checks: ["mcp_test"] },
      }),
    );
    assert.equal(invalidCheck.status, "rejected");
  });

  test("allows project directories through config while keeping protected boundaries scoped", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const allowed = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "config",
          description: "review ordinary project configuration files",
          profile: "config",
          operations: [
            {
              path: ".vscode/settings.json",
              content: '{"editor.formatOnSave":true}\n',
            },
            {
              path: ".well-known/discord",
              content: "project metadata\n",
            },
            {
              path: "biome.json",
              content: "{}\n",
            },
            {
              path: "docs/config.md",
              content: "# Config\n",
            },
            {
              path: "drizzle.config.ts",
              content: "export default {};\n",
            },
            {
              path: "index.html",
              content: "<!doctype html>\n",
            },
            {
              path: "mcp/config.ts",
              content: "export const toolConfig = true;\n",
            },
            {
              path: "public/asset.ts",
              content: "export const asset = true;\n",
            },
            {
              path: "scripts/config-check.mjs",
              content: "export const check = true;\n",
            },
            {
              path: "src/config.ts",
              content: "const config = true;\n",
            },
            {
              path: "tests/config.test.ts",
              content: "export const test = true;\n",
            },
            {
              path: "vite.config.ts",
              content: "export default {};\n",
            },
          ],
        },
      }),
    );
    assert.equal(allowed.status, "prepared");
    assert.deepEqual(allowed.files, [
      ".vscode/settings.json",
      ".well-known/discord",
      "biome.json",
      "docs/config.md",
      "drizzle.config.ts",
      "index.html",
      "mcp/config.ts",
      "public/asset.ts",
      "scripts/config-check.mjs",
      "src/config.ts",
      "tests/config.test.ts",
      "vite.config.ts",
    ]);

    const outOfProfile = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "config",
          description: "keep database migrations on the database profile",
          profile: "config",
          operations: [{ path: "migrations/0001_config.sql", content: "blocked\n" }],
        },
      }),
    );
    assert.equal(outOfProfile.status, "rejected");
  });

  test("maps database artifacts to the database profile", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const database = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "database",
          description: "review database configuration and schema artifacts",
          profile: "database",
          operations: [
            {
              path: "drizzle.config.ts",
              content: "export default {};\n",
            },
            {
              path: "migrations/0001_config.sql",
              content: "CREATE TABLE config (id INTEGER);\n",
            },
            {
              path: "src/data/Initial-Seed.sql",
              content: "INSERT INTO config (id) VALUES (1);\n",
            },
            {
              path: "src/db/schema.ts",
              content: "export const schema = true;\n",
            },
            {
              path: "wrangler.toml",
              content: 'name = "fixture"\n',
            },
          ],
        },
      }),
    );
    assert.equal(database.status, "prepared");
    assert.deepEqual(database.files, [
      "drizzle.config.ts",
      "migrations/0001_config.sql",
      "src/data/Initial-Seed.sql",
      "src/db/schema.ts",
      "wrangler.toml",
    ]);
  });

  test("fails closed outside Git and rejects symlink and sensitive paths", async () => {
    const outsideGit = await mkdtemp(join(tmpdir(), "operator-synaciel-outside-"));
    await writeFile(join(outsideGit, "package.json"), '{"name":"outside"}\n');
    try {
      const startup = spawnSync(tsx, [serverEntry], {
        cwd: outsideGit,
        env: { ...process.env, OPERATOR_SYNACIEL_MCP_ROOT: outsideGit },
        encoding: "utf8",
        shell: false,
      });
      assert.notEqual(startup.status, 0);
      assert.match(`${startup.stdout}\n${startup.stderr}`, /Git (?:root|worktree)/i);
    } finally {
      await rm(outsideGit, { recursive: true, force: true });
    }

    const repository = await createRepository();
    repositories.push(repository);
    await symlink("/tmp/operator-synaciel-outside-target", join(repository, "src/link.ts"));
    const server = await startServer(repository);
    servers.push(server);

    const symlinkResult = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "reject a symlink path",
          profile: "app",
          operations: [{ path: "src/link.ts", content: "blocked\n" }],
        },
      }),
    );
    assert.equal(symlinkResult.status, "rejected");

    const sensitiveResult = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "reject an environment path",
          profile: "app",
          operations: [{ path: "public/.env", content: "TOKEN=blocked\n" }],
        },
      }),
    );
    assert.equal(sensitiveResult.status, "rejected");
    assert.equal(repositoryRoot, process.cwd());
  });
});
