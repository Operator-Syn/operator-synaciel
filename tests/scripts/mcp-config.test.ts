import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import { checkMcpConfig } from "../../scripts/check-mcp-config.mjs";
import { buildLaunchSpec, resolveRepositoryRoot } from "../../scripts/mcp-launcher.mjs";
import { requireGit } from "../mcp/support.ts";

const repositories: string[] = [];

afterEach(async () => {
  await Promise.all(
    repositories.splice(0).map((repository) => rm(repository, { recursive: true, force: true })),
  );
});

describe("clone-safe MCP configuration", () => {
  test("validates the tracked generic and Codex registrations", async () => {
    const result = await checkMcpConfig();
    assert.deepEqual(result, { ok: true, errors: [] });
  });

  test("resolves a relocated Git checkout from a nested working directory", async () => {
    const repository = await mkdtemp(join(tmpdir(), "operator-synaciel-relocated-"));
    repositories.push(repository);
    const launcherDirectory = join(repository, "scripts");
    const nestedDirectory = join(repository, "src", "nested");
    await mkdir(launcherDirectory, { recursive: true });
    await mkdir(nestedDirectory, { recursive: true });
    requireGit(repository, ["init", "--quiet"]);

    assert.equal(
      resolveRepositoryRoot({ anchor: nestedDirectory, launcher: launcherDirectory }),
      repository,
    );

    const spec = buildLaunchSpec(repository, "repository");
    assert.equal(spec.env.OPERATOR_SYNACIEL_MCP_ROOT, repository);
    assert.equal(spec.args[0], join(repository, "mcp", "server.ts"));
  });

  test("fails closed outside Git", async () => {
    const outside = await mkdtemp(join(tmpdir(), "operator-synaciel-no-git-"));
    repositories.push(outside);
    await mkdir(join(outside, "scripts"));

    assert.throws(
      () => resolveRepositoryRoot({ anchor: outside, launcher: join(outside, "scripts") }),
      /requires a Git checkout/i,
    );
  });
});
