import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  createRepository,
  payload,
  removeRepository,
  requireGit,
  runGit,
  startServer,
} from "./support.ts";

const repositories: string[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(repositories.splice(0).map(removeRepository));
});

describe("approval-gated commit pipeline", () => {
  test("commits a reviewed working-tree path through the real pre-commit hook", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(join(repository, "apps/portfolio-web/src/one.ts"), "one after\n");
    const server = await startServer(repository);
    servers.push(server);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    assert.equal(prepared.status, "prepared");
    assert.deepEqual(prepared.paths, ["apps/portfolio-web/src/one.ts"]);

    const committed = payload(
      await server.call("tools/call", {
        name: "git_commit_working_tree",
        arguments: {
          operationId: prepared.operationId,
          approvalHash: prepared.approvalHash,
          commits: [
            {
              path: "apps/portfolio-web/src/one.ts",
              message: "Update the fixture source behavior.",
            },
          ],
        },
      }),
    );
    assert.equal(committed.status, "committed");
    assert.deepEqual(committed.filesPerCommit, [1]);
    assert.equal(runGit(repository, ["status", "--short"]).stdout.trim(), "");
    assert.equal(
      requireGit(repository, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]),
      "apps/portfolio-web/src/one.ts",
    );
  });

  test("requires one-time consent for restricted paths without exposing the marker", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await mkdir(join(repository, ".codex"), { recursive: true });
    await writeFile(join(repository, ".codex/fixture.md"), "restricted fixture\n");
    const server = await startServer(repository);
    servers.push(server);

    const challenge = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    assert.equal(challenge.status, "consent_required");
    assert.equal(
      JSON.stringify(challenge).includes("OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL"),
      false,
    );

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: { consentToken: challenge.consentToken, approveRestrictedPaths: true },
      }),
    );
    assert.equal(prepared.status, "prepared");

    const committed = payload(
      await server.call("tools/call", {
        name: "git_commit_working_tree",
        arguments: {
          operationId: prepared.operationId,
          approvalHash: prepared.approvalHash,
          commits: [{ path: ".codex/fixture.md", message: "Add the reviewed restricted fixture." }],
        },
      }),
    );
    assert.equal(committed.status, "committed");
    assert.equal(runGit(repository, ["status", "--short"]).stdout.trim(), "");
  });

  test("rejects incomplete shortened replacements unless explicitly acknowledged", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const path = "apps/portfolio-web/src/shortened.ts";
    const original = "one before\ntwo before\n";
    await writeFile(join(repository, path), original);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update(original).digest("hex");

    const rejected = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "reject an incomplete bounded read replacement",
          profile: "app",
          operations: [
            {
              path,
              content: "one before\n",
              expectedSha256,
            },
          ],
        },
      }),
    );
    assert.equal(rejected.status, "rejected");
    assert.match(String(rejected.message), /allowContentShortening/);
    assert.equal(await readFile(join(repository, path), "utf8"), original);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "explicitly approve an intentional shortening",
          profile: "app",
          operations: [
            {
              path,
              content: "one before\n",
              expectedSha256,
              allowContentShortening: true,
            },
          ],
        },
      }),
    );
    assert.equal(prepared.status, "prepared");

    const applied = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          expectedFileHashes: prepared.expectedFileHashes,
          approve: true,
        },
      }),
    );
    assert.equal(applied.status, "applied");
    assert.equal(await readFile(join(repository, path), "utf8"), "one before\n");
  });

  test("bounds planned diffs and exposes complete authenticated chunks", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const path = "apps/portfolio-web/src/large.ts";
    const content = "export const line = true;\n".repeat(1_500);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "prepare a bounded large diff",
          profile: "app",
          operations: [{ path, content }],
        },
      }),
    );
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.diffTruncated, true);
    assert.ok(String(prepared.diff).length <= 16_000);
    assert.ok(Number(prepared.diffTotalCharacters) > String(prepared.diff).length);
    assert.deepEqual(prepared.omittedPaths, [path]);
    const summary = (prepared.fileSummaries as Array<Record<string, unknown>>)[0];
    assert.equal(summary?.path, path);
    assert.equal(summary?.oldSha256, null);
    assert.equal(summary?.newSha256, createHash("sha256").update(content).digest("hex"));
    assert.equal(summary?.newBytes, Buffer.byteLength(content));

    let offset = 0;
    let assembled = "";
    while (true) {
      const chunk = payload(
        await server.call("tools/call", {
          name: "read_repository_change_diff",
          arguments: {
            planId: prepared.planId,
            applyToken: prepared.applyToken,
            offset,
            maxChars: 5_000,
          },
        }),
      );
      assembled += String(chunk.content);
      if (chunk.nextOffset === null) break;
      offset = Number(chunk.nextOffset);
    }
    assert.equal(assembled.length, prepared.diffTotalCharacters);

    const invalid = await server.call("tools/call", {
      name: "read_repository_change_diff",
      arguments: {
        planId: prepared.planId,
        applyToken: "stale-token",
      },
    });
    assert.ok(invalid.error || invalid.result?.isError);

    const applied = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          expectedFileHashes: prepared.expectedFileHashes,
          approve: true,
        },
      }),
    );
    assert.equal(applied.status, "applied");
    const staleAfterApply = await server.call("tools/call", {
      name: "read_repository_change_diff",
      arguments: { planId: prepared.planId, applyToken: prepared.applyToken },
    });
    assert.ok(staleAfterApply.error || staleAfterApply.result?.isError);
  });

  test("bounds dirty-tree previews and reads them through the prepared operation", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const content = "const dirtyLine = true;\n".repeat(1_500);
    await writeFile(join(repository, "apps/portfolio-web/src/one.ts"), content);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    assert.equal(prepared.status, "prepared");
    const snapshot = prepared.snapshot as Record<string, unknown>;
    assert.equal(snapshot.diffTruncated, true);
    assert.ok(String(snapshot.diff).length <= 16_000);
    assert.deepEqual(snapshot.omittedPaths, ["apps/portfolio-web/src/one.ts"]);

    const chunk = payload(
      await server.call("tools/call", {
        name: "read_working_tree_diff",
        arguments: {
          operationId: prepared.operationId,
          approvalHash: prepared.approvalHash,
          maxChars: 4_000,
        },
      }),
    );
    assert.equal(chunk.kind, "working-tree");
    assert.equal(chunk.offset, 0);
    assert.equal(chunk.diffTruncated, true);
    assert.equal(chunk.totalCharacters, snapshot.diffTotalCharacters);
    assert.equal(chunk.totalBytes, snapshot.diffTotalBytes);
  });

  test("applies a hashed change and commits the exact applied file", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);
    const expectedSha256 = createHash("sha256").update("one before\n").digest("hex");

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "exercise the applied change path",
          profile: "app",
          operations: [
            {
              path: "apps/portfolio-web/src/one.ts",
              content: "one applied\n",
              expectedSha256,
            },
          ],
        },
      }),
    );
    assert.equal(prepared.status, "prepared");

    const applied = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          expectedFileHashes: prepared.expectedFileHashes,
          approve: true,
        },
      }),
    );
    assert.equal(applied.status, "applied");
    assert.equal(applied.verificationProfile, "app");
    assert.equal(applied.verificationRequired, true);

    const suggestions = payload(
      await server.call("tools/call", {
        name: "prepare_commits",
        arguments: { operationId: applied.operationId, approvalHash: applied.approvalHash },
      }),
    );
    assert.deepEqual(suggestions.paths, ["apps/portfolio-web/src/one.ts"]);

    const committed = payload(
      await server.call("tools/call", {
        name: "git_commit_files",
        arguments: {
          operationId: applied.operationId,
          approvalHash: applied.approvalHash,
          commits: [
            {
              path: "apps/portfolio-web/src/one.ts",
              message: "Apply the reviewed source change.",
            },
          ],
        },
      }),
    );
    assert.equal(committed.status, "committed");
    assert.equal(runGit(repository, ["status", "--short"]).stdout.trim(), "");
  });

  test("rejects duplicate, unrelated, stale, and path-only commit requests before mutation", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(join(repository, "apps/portfolio-web/src/one.ts"), "one changed\n");
    await writeFile(join(repository, "apps/portfolio-web/src/two.ts"), "two changed\n");
    const server = await startServer(repository);
    servers.push(server);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    const paths = prepared.paths as string[];
    assert.equal(paths.length, 2);

    const duplicate = await server.call("tools/call", {
      name: "git_commit_working_tree",
      arguments: {
        operationId: prepared.operationId,
        approvalHash: prepared.approvalHash,
        commits: [
          { path: paths[0], message: "Update the first fixture path." },
          { path: paths[0], message: "Update the duplicate fixture path." },
        ],
      },
    });
    assert.ok(duplicate.error || duplicate.result?.isError);
    assert.equal(requireGit(repository, ["rev-list", "--count", "HEAD"]), "1");

    await writeFile(join(repository, paths[0]), "collaborator changed\n");
    const stale = await server.call("tools/call", {
      name: "git_commit_working_tree",
      arguments: {
        operationId: prepared.operationId,
        approvalHash: prepared.approvalHash,
        commits: paths.map((path) => ({ path, message: "Update the reviewed fixture behavior." })),
      },
    });
    assert.ok(stale.error || stale.result?.isError);
    assert.equal(requireGit(repository, ["rev-list", "--count", "HEAD"]), "1");
  });

  test("rolls back earlier writes when a later prepared write cannot be applied", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(join(repository, "apps/portfolio-web/src/not-dir"), "this is a file\n");
    const server = await startServer(repository);
    servers.push(server);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_repository_change",
        arguments: {
          taskType: "patch",
          description: "exercise atomic rollback",
          profile: "app",
          operations: [
            {
              path: "apps/portfolio-web/src/created.ts",
              content: "created then rolled back\n",
            },
            {
              path: "apps/portfolio-web/src/not-dir/blocked.ts",
              content: "this cannot be written\n",
            },
          ],
        },
      }),
    );
    assert.equal(prepared.status, "prepared");

    const applied = payload(
      await server.call("tools/call", {
        name: "apply_repository_change",
        arguments: {
          planId: prepared.planId,
          applyToken: prepared.applyToken,
          expectedFileHashes: prepared.expectedFileHashes,
          approve: true,
        },
      }),
    );
    assert.equal(applied.status, "failed");
    await assert.rejects(() => access(join(repository, "apps/portfolio-web/src/created.ts")));
  });

  test("commits untracked binary files and deletions as separate hook-visible commits", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await mkdir(join(repository, "apps/portfolio-web/public"), { recursive: true });
    await writeFile(
      join(repository, "apps/portfolio-web/public/fixture.png"),
      Buffer.from([0, 1, 2, 3]),
    );
    await rm(join(repository, "apps/portfolio-web/src/one.ts"));
    const server = await startServer(repository);
    servers.push(server);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    const paths = prepared.paths as string[];
    assert.deepEqual(
      new Set(paths),
      new Set(["apps/portfolio-web/public/fixture.png", "apps/portfolio-web/src/one.ts"]),
    );
    const committed = payload(
      await server.call("tools/call", {
        name: "git_commit_working_tree",
        arguments: {
          operationId: prepared.operationId,
          approvalHash: prepared.approvalHash,
          commits: paths.map((path) => ({ path, message: `Review the ${path} change.` })),
        },
      }),
    );
    assert.equal(committed.status, "committed");
    assert.deepEqual(committed.filesPerCommit, [1, 1]);
    assert.equal(runGit(repository, ["status", "--short"]).stdout.trim(), "");
  });

  test("commits a tracked deletion from an ignored runtime directory", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const runtimePath = ".wrangler/state/fixture.sqlite";
    await mkdir(join(repository, ".wrangler/state"), { recursive: true });
    await writeFile(join(repository, ".gitignore"), ".wrangler\n");
    requireGit(repository, ["add", ".gitignore"]);
    requireGit(repository, ["commit", "--quiet", "-m", "Add the runtime ignore rule."]);
    await writeFile(join(repository, runtimePath), "runtime state\n");
    requireGit(repository, ["add", "--force", runtimePath]);
    requireGit(repository, ["commit", "--quiet", "-m", "Add the ignored runtime fixture."]);
    await rm(join(repository, runtimePath));
    const server = await startServer(repository);
    servers.push(server);

    const prepared = payload(
      await server.call("tools/call", {
        name: "prepare_working_tree_commit",
        arguments: {},
      }),
    );
    assert.equal(prepared.status, "prepared");
    assert.deepEqual(prepared.paths, [runtimePath]);
    assert.match(String((prepared.snapshot as Record<string, unknown>).diff), /fixture\.sqlite/);

    const committed = payload(
      await server.call("tools/call", {
        name: "git_commit_working_tree",
        arguments: {
          operationId: prepared.operationId,
          approvalHash: prepared.approvalHash,
          commits: [{ path: runtimePath, message: "Remove the obsolete runtime fixture." }],
        },
      }),
    );
    assert.equal(committed.status, "committed");
    assert.equal(runGit(repository, ["status", "--short"]).stdout.trim(), "");
  });

  test("the versioned pre-commit hook rejects direct multi-path commits", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    await writeFile(join(repository, "apps/portfolio-web/src/one.ts"), "one direct\n");
    await writeFile(join(repository, "apps/portfolio-web/src/two.ts"), "two direct\n");
    requireGit(repository, ["add", "--all"]);
    const result = runGit(repository, ["commit", "--quiet", "-m", "Attempt a grouped commit."]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /exactly one staged path/i);
  });
});
