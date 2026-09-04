import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { afterEach, describe, test } from "node:test";

import { createRepository, payload, removeRepository, startServer } from "./support.ts";

const repositories: string[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(repositories.splice(0).map(removeRepository));
});

describe("natural repository editing", () => {
  test("advertises a bounded repository search capability", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const listed = await server.call("tools/list");
    const tool = listed.result?.tools?.find((candidate) => candidate.name === "search_repository");

    assert.ok(tool);
    assert.ok(tool.outputSchema);
  });

  test("finds literal text and returns line-oriented match metadata", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/call", {
      name: "search_repository",
      arguments: {
        profile: "app",
        query: "one before",
      },
    });
    const result = payload(response);

    assert.equal(result.status, "ok");
    assert.deepEqual(result.matches, [
      {
        path: "apps/portfolio-web/src/one.ts",
        line: 1,
        column: 1,
        preview: "one before",
        sha256: createHash("sha256").update("one before\n").digest("hex"),
      },
    ]);
  });

  test("searches dirty and untracked text literally within the selected profile", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(`${repository}/apps/portfolio-web/src/untracked.ts`, "shell token [literal]\n");
    await mkdir(`${repository}/apps/portfolio-web/src/ignored`, { recursive: true });
    await writeFile(`${repository}/apps/portfolio-web/src/ignored/secret.ts`, "shell token\n");
    await writeFile(`${repository}/.gitignore`, "apps/portfolio-web/src/ignored/\n");
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/call", {
      name: "search_repository",
      arguments: {
        profile: "app",
        query: "[literal]",
      },
    });
    const result = payload(response);
    const matches = result.matches as Array<Record<string, unknown>>;

    assert.equal(matches[0]?.path, "apps/portfolio-web/src/untracked.ts");
    assert.equal(matches.length, 1);
  });

  test("bounds search results and reports continuation metadata", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(`${repository}/apps/portfolio-web/src/many.ts`, "needle\n".repeat(5));
    const server = await startServer(repository);
    servers.push(server);

    const result = payload(
      await server.call("tools/call", {
        name: "search_repository",
        arguments: { profile: "app", query: "needle", maxResults: 2 },
      }),
    );

    assert.equal((result.matches as Array<Record<string, unknown>>).length, 2);
    assert.equal(result.truncated, true);
    assert.equal(result.nextOffset, 2);
    assert.equal(result.reasonCode, "SEARCH_LIMIT_REACHED");
  });

  test("reads an inclusive line range without requiring a character offset", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [{ path: "apps/portfolio-web/src/one.ts", startLine: 1, endLine: 1 }],
      },
    });
    const result = payload(response);
    const file = (result.files as Array<Record<string, unknown>>)[0];

    assert.equal(file?.content, "one before\n");
    assert.equal(file?.startLine, 1);
    assert.equal(file?.endLine, 1);
    assert.equal(file?.nextLine, null);
    assert.equal(file?.totalLines, 1);
  });

  test("returns structured recovery for an invalid line range", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/call", {
      name: "read_repository_files",
      arguments: {
        profile: "app",
        files: [{ path: "apps/portfolio-web/src/one.ts", startLine: 2, endLine: 3 }],
      },
    });

    assert.equal(response.result?.isError, true);
    assert.equal(response.result?.structuredContent?.reasonCode, "LINE_RANGE_INVALID");
    assert.deepEqual(response.result?.structuredContent?.nextAction, {
      tool: "search_repository",
    });
  });

  test("prepares an exact replacement and line deletion without resending the file", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");

    const response = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        profile: "app",
        description: "replace the fixture text",
        operations: [
          {
            action: "edit",
            path: "apps/portfolio-web/src/one.ts",
            expectedSha256,
            replacements: [{ oldText: "one before", newText: "one after" }],
          },
        ],
      },
    });
    const result = payload(response);

    assert.equal(result.status, "prepared");
    assert.equal(String(result.reviewHash).length, 64);
    assert.equal(String(result.instanceId).length > 0, true);
    assert.equal(String(result.expiresAt).length > 0, true);
  });

  test("prepares an exact line deletion without resending the file", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");

    const response = await server.call("tools/call", {
      name: "prepare_repository_change",
      arguments: {
        profile: "app",
        description: "delete the fixture line",
        operations: [
          {
            action: "edit",
            path: "apps/portfolio-web/src/one.ts",
            expectedSha256,
            replacements: [{ oldText: "one before\n", newText: "" }],
          },
        ],
      },
    });
    const result = payload(response);

    assert.equal(result.status, "prepared");
    const summaries = result.fileSummaries as Array<Record<string, unknown>>;
    assert.equal(summaries[0]?.newBytes, 0);
  });

  test("rejects an ambiguous exact edit before mutating the file", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(`${repository}/apps/portfolio-web/src/one.ts`, "repeat\nrepeat\n");
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("repeat\nrepeat\n").digest("hex");

    const result = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "reject an ambiguous edit",
          operations: [
            {
              action: "edit",
              path: "apps/portfolio-web/src/one.ts",
              expectedSha256,
              replacements: [{ oldText: "repeat", newText: "changed" }],
            },
          ],
        },
      }),
    );

    assert.equal(result.status, "rejected");
    assert.equal(result.reasonCode, "AMBIGUOUS_EDIT");
    assert.equal(result.retryable, true);
  });

  test("applies the reviewed plan with a review hash and safely retries it", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "replace the fixture text",
          operations: [
            {
              action: "edit",
              path: "apps/portfolio-web/src/one.ts",
              expectedSha256,
              replacements: [{ oldText: "one before", newText: "one after" }],
            },
          ],
        },
      }),
    );

    const applyArguments = {
      planId: prepared.planId,
      applyToken: prepared.applyToken,
      reviewHash: prepared.reviewHash,
      approve: true,
    };
    const first = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: applyArguments,
      }),
    );
    const second = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: applyArguments,
      }),
    );

    assert.equal(first.status, "applied");
    assert.deepEqual(second, first);
  });

  test("returns actionable structured recovery for a missing plan", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call("tools/call", {
      name: "apply_repository_change",
      arguments: {
        planId: "missing",
        applyToken: "missing",
        reviewHash: "0".repeat(64),
        approve: true,
      },
    });
    const result = payload(response);

    assert.equal(result.status, "rejected");
    assert.equal(result.reasonCode, "PLAN_UNAVAILABLE");
    assert.equal(result.retryable, true);
    assert.deepEqual(result.nextAction, { tool: "prepare_repository_change" });
  });

  test("rejects a changed file with current hash details and no mutation", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");
    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "prepare a stale edit",
          operations: [
            {
              action: "edit",
              path: "apps/portfolio-web/src/one.ts",
              expectedSha256,
              replacements: [{ oldText: "one before", newText: "one after" }],
            },
          ],
        },
      }),
    );
    await writeFile(`${repository}/apps/portfolio-web/src/one.ts`, "collaborator\n");

    const result = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          reviewHash: prepared.reviewHash,
          approve: true,
        },
      }),
    );

    assert.equal(result.status, "conflict");
    assert.equal(result.reasonCode, "HASH_MISMATCH");
    assert.equal(result.retryable, true);
    const conflicts = result.conflicts as Array<Record<string, unknown>>;
    assert.equal(conflicts[0]?.path, "apps/portfolio-web/src/one.ts");
  });

  test("does not accept a review hash from a different prepared plan", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");
    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "prepare a review hash check",
          operations: [
            {
              action: "edit",
              path: "apps/portfolio-web/src/one.ts",
              expectedSha256,
              replacements: [{ oldText: "one before", newText: "one after" }],
            },
          ],
        },
      }),
    );

    const result = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          reviewHash: "0".repeat(64),
          approve: true,
        },
      }),
    );

    assert.equal(result.status, "rejected");
    assert.equal(result.reasonCode, "REVIEW_HASH_MISMATCH");
    assert.equal(result.retryable, false);
  });

  test("completes search, focused read, review, and edit through one stdio session", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const search = payload(
      await server.call("tools/call", {
        name: "search_repository",
        arguments: { profile: "app", query: "one before" },
      }),
    );
    const match = (search.matches as Array<Record<string, unknown>>)[0];
    assert.ok(match);
    const read = payload(
      await server.call("tools/call", {
        name: "read_repository_files",
        arguments: {
          profile: "app",
          files: [
            {
              path: String(match.path),
              startLine: Number(match.line),
              endLine: Number(match.line),
            },
          ],
        },
      }),
    );
    const file = (read.files as Array<Record<string, unknown>>)[0];
    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "complete the natural stdio edit flow",
          operations: [
            {
              action: "edit",
              path: String(match.path),
              expectedSha256: String(file.sha256),
              replacements: [{ oldText: String(file.content).trim(), newText: "one after" }],
            },
          ],
        },
      }),
    );
    const diff = payload(
      await server.call("tools/call", {
        name: "read_repository_change_diff",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
        },
      }),
    );
    assert.match(String(diff.content), /one after/);
    const applied = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          reviewHash: prepared.reviewHash,
          approve: true,
        },
      }),
    );

    assert.equal(applied.status, "applied");
    assert.equal(
      await readFile(`${repository}/apps/portfolio-web/src/one.ts`, "utf8"),
      "one after\n",
    );
  });

  test("reports an unavailable plan after the server process is replaced", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const firstServer = await startServer(repository);
    servers.push(firstServer);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");
    const prepared = payload(
      await firstServer.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          profile: "app",
          description: "prepare before reconnect",
          operations: [
            {
              action: "edit",
              path: "apps/portfolio-web/src/one.ts",
              expectedSha256,
              replacements: [{ oldText: "one before", newText: "one after" }],
            },
          ],
        },
      }),
    );
    const firstInstance = prepared.instanceId;
    servers.splice(servers.indexOf(firstServer), 1);
    await firstServer.close();
    const secondServer = await startServer(repository);
    servers.push(secondServer);

    const result = payload(
      await secondServer.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          reviewHash: prepared.reviewHash,
          approve: true,
        },
      }),
    );

    assert.equal(result.status, "rejected");
    assert.equal(result.reasonCode, "PLAN_UNAVAILABLE");
    assert.equal(result.retryable, true);
    assert.notEqual(result.instanceId, firstInstance);
  });
});
