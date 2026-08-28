import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { PROJECT_ROOT } from "./path.ts";

const LOCK_DIRECTORY_NAME = "operator-synaciel-mcp-mutation.lock";
const LOCK_WAIT_TIMEOUT_MS = 120_000;
const LOCK_STALE_AFTER_MS = 30 * 60 * 1_000;
const LOCK_POLL_INTERVAL_MS = 50;

type LockOwner = {
  readonly pid: number;
  readonly token: string;
  readonly createdAt: number;
};

type ReleaseLock = () => Promise<void>;

const queuedMutations = new Map<string, Promise<void>>();

function gitCommonDirectory(root: string): string {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
    timeout: 5_000,
    shell: false,
  });
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error("Could not resolve the Git directory for the mutation lock.");
  }
  const configured = result.stdout.trim();
  return isAbsolute(configured) ? resolve(configured) : resolve(root, configured);
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function lockIsStale(lockPath: string, ownerPath: string): Promise<boolean> {
  const owner = await readFile(ownerPath, "utf8")
    .then((content) => JSON.parse(content) as LockOwner)
    .catch(() => null);
  if (owner) return !processIsAlive(owner.pid);
  const createdAt = (await stat(lockPath).catch(() => null))?.mtimeMs ?? 0;
  return Date.now() - createdAt > LOCK_STALE_AFTER_MS;
}

async function acquireMutationLock(root: string): Promise<ReleaseLock> {
  const lockPath = join(gitCommonDirectory(root), LOCK_DIRECTORY_NAME);
  const ownerPath = join(lockPath, "owner.json");
  const owner: LockOwner = { pid: process.pid, token: randomUUID(), createdAt: Date.now() };
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;

  while (true) {
    try {
      await mkdir(lockPath);
      try {
        await writeFile(ownerPath, JSON.stringify(owner), { encoding: "utf8", flag: "wx" });
      } catch (error) {
        await rm(lockPath, { recursive: true, force: true });
        throw error;
      }
      return async () => {
        const current = await readFile(ownerPath, "utf8")
          .then((content) => JSON.parse(content) as LockOwner)
          .catch(() => null);
        if (current?.token === owner.token) {
          await rm(lockPath, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await lockIsStale(lockPath, ownerPath)) {
        const stalePath = `${lockPath}.stale-${randomUUID()}`;
        try {
          await rename(lockPath, stalePath);
          await rm(stalePath, { recursive: true, force: true });
        } catch (reclaimError) {
          const code = (reclaimError as NodeJS.ErrnoException).code;
          if (code !== "ENOENT" && code !== "EEXIST") throw reclaimError;
        }
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error("Another repository mutation is in progress for this checkout.");
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, LOCK_POLL_INTERVAL_MS));
    }
  }
}

export async function withMutationLock<T>(
  operation: () => Promise<T>,
  root = PROJECT_ROOT,
): Promise<T> {
  const key = resolve(root);
  const predecessor = queuedMutations.get(key) ?? Promise.resolve();
  let releaseQueue!: () => void;
  const turn = new Promise<void>((resolveTurn) => {
    releaseQueue = resolveTurn;
  });
  const queue = predecessor.then(() => turn);
  queuedMutations.set(key, queue);

  await predecessor;
  let releaseLock: ReleaseLock | undefined;
  try {
    releaseLock = await acquireMutationLock(key);
    return await operation();
  } finally {
    try {
      await releaseLock?.();
    } finally {
      releaseQueue();
      if (queuedMutations.get(key) === queue) queuedMutations.delete(key);
    }
  }
}
