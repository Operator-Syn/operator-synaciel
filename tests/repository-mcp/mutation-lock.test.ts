import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";

import {
  mutationLockPath,
  withMutationLock,
} from "../../tools/repository-mcp/src/mutation-lock.ts";
import { createRepository, removeRepository } from "./support.ts";

const repositories: string[] = [];

afterEach(async () => {
  await Promise.all(repositories.splice(0).map(removeRepository));
});

describe("checkout mutation lock", () => {
  test("queues same-process operations and runs them without overlap", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const events: string[] = [];

    const first = withMutationLock(async () => {
      events.push("first:start");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
      events.push("first:end");
      return "first";
    }, repository);
    const second = withMutationLock(async () => {
      events.push("second:start");
      events.push("second:end");
      return "second";
    }, repository);

    assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
    assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
  });

  test("reclaims a lock whose recorded owner is no longer alive", async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const lockPath = mutationLockPath(repository);
    await mkdir(lockPath, { recursive: true });
    await writeFile(
      join(lockPath, "owner.json"),
      JSON.stringify({ pid: Number.MAX_SAFE_INTEGER, token: "stale", createdAt: Date.now() }),
    );

    await withMutationLock(async () => undefined, repository);
    await assert.rejects(access(lockPath));
  });
});
