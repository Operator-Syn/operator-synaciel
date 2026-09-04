import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  createRepository,
  type JsonRpcMessage,
  payload,
  removeRepository,
  repositoryRoot,
  serverEntry,
  startServer,
  tsx,
} from "./support.ts";

const repositories: string[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

function assertStructuredResponse(response: JsonRpcMessage): Record<string, unknown> {
  const text = response.result?.content?.[0]?.text;
  const structuredContent = response.result?.structuredContent;

  assert.ok(text);
  assert.ok(structuredContent);
  assert.ok(text.length <= 500);
  assert.equal(text.includes("\n"), false);
  assert.equal(text.trim().startsWith("{"), false);

  return structuredContent;
}

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
        "search_repository",
        "prepare_repository_change",
        "apply_repository_change",
        "verify_repository_change",
        "read_repository_change_diff",
        "read_repository_files",
        "grant_repository_read_access",
        "read_working_tree_diff",
        "prepare_working_tree_commit",
        "git_commit_working_tree",
        "prepare_commits",
        "git_commit_files",
      ]),
    );
    const instructions = server.initialization.result?.instructions ?? "";
    assert.ok(instructions.length < 500);
    assert.match(instructions, /Local repository MCP/);
    assert.match(instructions, /selected profile/);
    assert.match(instructions, /approved apply/);
  });

  test("advertises output schemas and structured text-compatible results", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const listed = await server.call("tools/list");
    const tools = listed.result?.tools ?? [];
    assert.equal(tools.length, 13);
    for (const tool of tools) {
      assert.ok(tool.outputSchema);
      const properties = (tool.inputSchema?.properties ?? {}) as Record<string, unknown>;
      assert.equal("responseMode" in properties, false);
      assert.equal("taskType" in properties, false);
      assert.equal("expectedFileHashes" in properties, false);
    }
    const prepareTool = tools.find((tool) => tool.name === "prepare_repository_change");
    const applyTool = tools.find((tool) => tool.name === "apply_repository_change");
    const prepareProperties = (prepareTool?.inputSchema?.properties ?? {}) as Record<
      string,
      unknown
    >;
    const applyProperties = (applyTool?.inputSchema?.properties ?? {}) as Record<string, unknown>;
    assert.equal("taskType" in prepareProperties, false);
    assert.equal("responseMode" in prepareProperties, false);
    assert.equal("expectedFileHashes" in applyProperties, false);
    assert.equal("responseMode" in applyProperties, false);

    const status = await server.call("tools/call", {
      name: "repository_workflow_status",
      arguments: {},
    });
    const statusPayload = assertStructuredResponse(status);
    assert.equal(statusPayload.status, "attention");
    const serverMetadata = statusPayload.server as Record<string, unknown>;
    assert.equal(serverMetadata.version, "2.0.0");
    assert.equal(typeof serverMetadata.instanceId, "string");
    const verificationProfiles = (statusPayload.capabilities as Record<string, unknown>)
      .verificationProfiles as Record<string, unknown>;
    assert.equal(typeof verificationProfiles, "object");
    assert.ok("mcp-fast" in verificationProfiles);
    assert.ok("repository" in verificationProfiles);
    const writeProfiles = (statusPayload.capabilities as Record<string, unknown>)
      .writeProfiles as string[];
    assert.ok(writeProfiles.includes("repository"));
    assert.ok((verificationProfiles.repository as string[]).includes("api_typecheck"));

    const cachedStatus = await server.call("tools/call", {
      name: "repository_workflow_status",
      arguments: {},
    });
    assert.equal(assertStructuredResponse(cachedStatus).cacheHit, true);

    const structuredStatus = await server.call("tools/call", {
      name: "repository_workflow_status",
      arguments: {},
    });
    assertStructuredResponse(structuredStatus);

    const prepared = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "exercise structured repository output",
        profile: "app",
        verifyOnApply: false,
        operations: [
          {
            path: "apps/portfolio-web/src/structured-output.ts",
            content: "export const structuredOutput = true;\n",
          },
        ],
      },
    });
    const preparedPayload = assertStructuredResponse(prepared);
    assert.equal(preparedPayload.status, "prepared");
    assert.equal(preparedPayload.verificationMode, "deferred");
    assert.equal(preparedPayload.verificationRequired, true);
    assert.equal(prepared.result?.content?.[0]?.text?.includes("\n"), false);

    const sourceRead = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [
          { path: "apps/portfolio-web/src/one.ts", offset: 0 },
          { path: "apps/portfolio-web/src/missing.ts" },
        ],
        maxChars: 4,
      },
    });
    const sourcePayload = assertStructuredResponse(sourceRead);
    const sourceFiles = sourcePayload.files as Array<Record<string, unknown>>;
    assert.equal(sourceFiles[0]?.content, "one ");
    assert.equal(sourceFiles[0]?.nextOffset, 4);
    assert.equal(sourceFiles[1]?.exists, false);
    assert.deepEqual(sourcePayload.omittedPaths, []);

    const requestedPath = "workers/portfolio-api/src/entrypoint.ts";
    const deniedRead = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [{ path: requestedPath }],
      },
    });
    assert.equal(deniedRead.result?.isError, true);
    const deniedReadPayload = deniedRead.result?.structuredContent;
    assert.match(String(deniedReadPayload?.message), /Path ".*entrypoint\.ts" is not allowed/);
    assert.equal(deniedReadPayload?.reasonCode, "READ_PERMISSION_REQUIRED");
    assert.deepEqual(deniedReadPayload?.nextAction, {
      tool: "grant_repository_read_access",
    });

    const deniedWrite = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "verify write profile boundaries remain explicit",
        profile: "app",
        operations: [{ path: requestedPath, content: "not written\n" }],
      },
    });
    const deniedWritePayload = assertStructuredResponse(deniedWrite);
    assert.equal(deniedWritePayload.status, "rejected");
    assert.match(
      String(deniedWritePayload.message),
      /Path "workers\/portfolio-api\/src\/entrypoint\.ts" is not allowed by the app write profile/,
    );

    const missingScope = await server.call("tools/call", {
      name: "grant_repository_read_access",
      arguments: {
        profile: "app",
        paths: [requestedPath],
        approve: true,
      },
    });
    assert.equal(missingScope.result?.isError, true);
    assert.match(
      missingScope.result?.content?.[0]?.text ?? "",
      /Interactive permission selection is unavailable|choose temporary or permanent/,
    );

    const permission = await server.call("tools/call", {
      name: "grant_repository_read_access",
      arguments: {
        profile: "app",
        paths: [requestedPath],
        scope: "temporary",
        approve: true,
      },
    });
    const permissionPayload = assertStructuredResponse(permission);
    assert.equal(permissionPayload.status, "granted");
    assert.equal(permissionPayload.scope, "temporary");
    assert.equal(typeof permissionPayload.permissionToken, "string");

    const permittedRead = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [{ path: requestedPath }],
        permissionToken: permissionPayload.permissionToken,
      },
    });
    const permittedPayload = assertStructuredResponse(permittedRead);
    assert.equal((permittedPayload.files as Array<Record<string, unknown>>)[0]?.exists, false);

    const stillDeniedWrite = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "ensure read grants do not widen write access",
        profile: "app",
        operations: [{ path: requestedPath, content: "not written\n" }],
      },
    });
    const stillDeniedWritePayload = assertStructuredResponse(stillDeniedWrite);
    assert.equal(stillDeniedWritePayload.status, "rejected");
    assert.match(String(stillDeniedWritePayload.message), /app write profile/);

    const reusedPermission = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [{ path: requestedPath }],
        permissionToken: permissionPayload.permissionToken,
      },
    });
    assert.equal(reusedPermission.result?.isError, true);
    assert.match(reusedPermission.result?.content?.[0]?.text ?? "", /temporary access/);

    const broadRead = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "repository",
        files: [
          { path: "workers/portfolio-api/src/entrypoint.ts", offset: 0 },
          { path: "apps/portfolio-web/src/one.ts", offset: 0 },
        ],
        maxChars: 8,
      },
    });
    const broadPayload = assertStructuredResponse(broadRead);
    assert.equal(broadPayload.profile, "repository");
    const broadFiles = broadPayload.files as Array<Record<string, unknown>>;
    assert.equal(broadFiles[0]?.exists, false);
    assert.equal(broadFiles[0]?.content, "");
    assert.equal(broadFiles[1]?.content, "one befo");

    const broadPrepared = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "exercise the broad repository profile",
        profile: "repository",
        operations: [
          {
            path: "workers/portfolio-api/src/entrypoint.ts",
            content: "export const preparedApi = true;\n",
          },
        ],
      },
    });
    const broadPreparedPayload = assertStructuredResponse(broadPrepared);
    assert.equal(broadPreparedPayload.status, "prepared");
    assert.deepEqual(broadPreparedPayload.files, ["workers/portfolio-api/src/entrypoint.ts"]);

    const diff = await server.call("tools/call", {
      name: "read_repository_change_diff",
      arguments: {
        planId: assertStructuredResponse(prepared).planId,
        applyToken: assertStructuredResponse(prepared).applyToken,
        maxChars: 8_000,
      },
    });
    const diffPayload = assertStructuredResponse(diff);
    assert.equal(diffPayload.kind, "repository-change");
    assert.equal(typeof diffPayload.totalCharacters, "number");
    assert.ok(diffPayload.nextOffset === null || typeof diffPayload.nextOffset === "number");

    const rejected = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "reject traversal",
        profile: "app",
        operations: [{ path: "../outside.txt", content: "nope\n" }],
      },
    });
    assert.equal(assertStructuredResponse(rejected).status, "rejected");

    const tooMany = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        description: "reject an oversized prepared file set",
        profile: "app",
        operations: Array.from({ length: 21 }, (_, index) => ({
          path: `apps/portfolio-web/src/many-${index}.ts`,
          content: `${index}\n`,
        })),
      },
    });
    assert.ok(tooMany.error || tooMany.result?.isError);
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

  test("rejects binary planned changes even in the broad repository profile", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const rejected = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          description: "reject binary text changes",
          profile: "repository",
          operations: [
            {
              path: "apps/portfolio-web/public/social-image.png",
              content: "not a text source\n",
            },
          ],
        },
      }),
    );
    assert.equal(rejected.status, "rejected");
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
          description: "review ordinary project configuration files",
          profile: "config",
          operations: [
            {
              path: ".vscode/settings.json",
              content: '{"editor.formatOnSave":true}\n',
            },
            {
              path: "apps/portfolio-web/public/.well-known/discord",
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
              path: "workers/portfolio-api/drizzle.config.ts",
              content: "export default {};\n",
            },
            {
              path: "apps/portfolio-web/index.html",
              content: "<!doctype html>\n",
            },
            {
              path: "tools/repository-mcp/config.ts",
              content: "export const toolConfig = true;\n",
            },
            {
              path: "apps/portfolio-web/public/asset.ts",
              content: "export const asset = true;\n",
            },
            {
              path: "scripts/config-check.mjs",
              content: "export const check = true;\n",
            },
            {
              path: "apps/portfolio-web/src/config.ts",
              content: "const config = true;\n",
            },
            {
              path: "tests/config.test.ts",
              content: "export const test = true;\n",
            },
            {
              path: "apps/portfolio-web/vite.config.ts",
              content: "export default {};\n",
            },
          ],
        },
      }),
    );
    assert.equal(allowed.status, "prepared");
    assert.deepEqual(allowed.files, [
      ".vscode/settings.json",
      "apps/portfolio-web/public/.well-known/discord",
      "biome.json",
      "docs/config.md",
      "workers/portfolio-api/drizzle.config.ts",
      "apps/portfolio-web/index.html",
      "tools/repository-mcp/config.ts",
      "apps/portfolio-web/public/asset.ts",
      "scripts/config-check.mjs",
      "apps/portfolio-web/src/config.ts",
      "tests/config.test.ts",
      "apps/portfolio-web/vite.config.ts",
    ]);

    const outOfProfile = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          description: "keep database migrations on the database profile",
          profile: "config",
          operations: [
            {
              path: "workers/portfolio-api/migrations/0001_config.sql",
              content: "blocked\n",
            },
          ],
        },
      }),
    );
    assert.equal(outOfProfile.status, "rejected");
  });

  test("allows the project skill lockfile through the mcp profile", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const lockfile = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          description: "review the project-local skill lockfile",
          profile: "mcp",
          operations: [{ path: "skills-lock.json", content: '{"version":1}\n' }],
        },
      }),
    );
    assert.equal(lockfile.status, "prepared");
    assert.deepEqual(lockfile.files, ["skills-lock.json"]);
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
          description: "review database configuration and schema artifacts",
          profile: "database",
          operations: [
            {
              path: "workers/portfolio-api/drizzle.config.ts",
              content: "export default {};\n",
            },
            {
              path: "workers/portfolio-api/migrations/0001_config.sql",
              content: "CREATE TABLE config (id INTEGER);\n",
            },
            {
              path: "workers/portfolio-api/src/data/Initial-Seed.sql",
              content: "INSERT INTO config (id) VALUES (1);\n",
            },
            {
              path: "workers/portfolio-api/src/db/schema.ts",
              content: "export const schema = true;\n",
            },
            {
              path: "workers/portfolio-api/wrangler.toml",
              content: 'name = "fixture"\n',
            },
          ],
        },
      }),
    );
    assert.equal(database.status, "prepared");
    assert.deepEqual(database.files, [
      "workers/portfolio-api/drizzle.config.ts",
      "workers/portfolio-api/migrations/0001_config.sql",
      "workers/portfolio-api/src/data/Initial-Seed.sql",
      "workers/portfolio-api/src/db/schema.ts",
      "workers/portfolio-api/wrangler.toml",
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
    await mkdir(join(repository, "apps/portfolio-web/src"), { recursive: true });
    await symlink(
      "/tmp/operator-synaciel-outside-target",
      join(repository, "apps/portfolio-web/src/link.ts"),
    );
    const server = await startServer(repository);
    servers.push(server);

    const symlinkResult = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          description: "reject a symlink path",
          profile: "app",
          operations: [{ path: "apps/portfolio-web/src/link.ts", content: "blocked\n" }],
        },
      }),
    );
    assert.equal(symlinkResult.status, "rejected");

    const sensitiveResult = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          description: "reject an environment path",
          profile: "app",
          operations: [{ path: "apps/portfolio-web/public/.env", content: "TOKEN=blocked\n" }],
        },
      }),
    );
    assert.equal(sensitiveResult.status, "rejected");
    assert.equal(repositoryRoot, resolve(import.meta.dirname, "../.."));
  });
});
