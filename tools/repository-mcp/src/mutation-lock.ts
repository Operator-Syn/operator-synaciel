import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { PROJECT_ROOT } from "./path.ts";

const LOCK_DIRECTORY_PREFIX = "operator-synaciel-mcp-mutation";
const LOCK_WAIT_TIMEOUT_MS = 120_000;
const LOCK_STALE_AFTER_MS = 30 * 60 * 1_000;
const LOCK_MIN_POLL_INTERVAL_MS = 25;
const LOCK_MAX_POLL_INTERVAL_MS = 1_000;

type LockOwner = {
  readonly pid: number;
  readonly token: string;
  readonly createdAt: number;
  readonly checkoutRoot: string;
};

type ReleaseLock = () => Promise<void>;

const queuedMutations = new Map<string, Promise<void>>();
const commonDirectoryCache = new Map<string, string>();

function canonicalCheckoutRoot(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

function gitCommonDirectory(root: string): string {
  const canonicalRoot = canonicalCheckoutRoot(root);
  const cached = commonDirectoryCache.get(canonicalRoot);
  if (cached) return cached;

  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: canonicalRoot,
    encoding: "utf8",
    timeout: 5_000,
    shell: false,
  });
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error("Could not resolve the Git directory for the mutation lock.");
  }
  const configured = result.stdout.trim();
  const commonDirectory = isAbsolute(configured)
    ? resolve(configured)
    : resolve(canonicalRoot, configured);
  commonDirectoryCache.set(canonicalRoot, commonDirectory);
  return commonDirectory;
}

export function mutationLockPath(root = PROJECT_ROOT): string {
  const canonicalRoot = canonicalCheckoutRoot(root);
  const key = createHash("sha256").update(canonicalRoot).digest("hex").slice(0, 24);
  return join(gitCommonDirectory(canonicalRoot), `${LOCK_DIRECTORY_PREFIX}-${key}.lock`);
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
    .then((content) => JSON.parse(content) as Partial<LockOwner>)
    .catch(() => null);
  const ownerPid = owner?.pid;
  const ownerCreatedAt = owner?.createdAt;
  if (
    typeof ownerPid === "number" &&
    Number.isInteger(ownerPid) &&
    ownerPid > 0 &&
    typeof ownerCreatedAt === "number" &&
    Number.isFinite(ownerCreatedAt)
  ) {
    return !processIsAlive(ownerPid);
  }
  const createdAt = (await stat(lockPath).catch(() => null))?.mtimeMs ?? 0;
  return Date.now() - createdAt > LOCK_STALE_AFTER_MS;
}

async function acquireMutationLock(root: string): Promise<ReleaseLock> {
  const lockPath = mutationLockPath(root);
  const ownerPath = join(lockPath, "owner.json");
  const owner: LockOwner = {
    pid: process.pid,
    token: randomUUID(),
    createdAt: Date.now(),
    checkoutRoot: canonicalCheckoutRoot(root),
  };
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  let pollDelay = LOCK_MIN_POLL_INTERVAL_MS;

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
          .then((content) => JSON.parse(content) as Partial<LockOwner>)
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
        pollDelay = LOCK_MIN_POLL_INTERVAL_MS;
        continue;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error("Another repository mutation is in progress for this checkout.");
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(pollDelay, remaining)));
      pollDelay = Math.min(LOCK_MAX_POLL_INTERVAL_MS, pollDelay * 2);
    }
  }
}

export async function withMutationLock<T>(
  operation: () => Promise<T>,
  root = PROJECT_ROOT,
): Promise<T> {
  const key = canonicalCheckoutRoot(root);
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
