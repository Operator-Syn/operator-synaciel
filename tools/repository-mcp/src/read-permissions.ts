import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { isLikelyBinaryPath, PROJECT_ROOT, validateRelativeProjectPath } from "./path.ts";
import { REPOSITORY_WRITE_PROFILES, type RepositoryWriteProfile } from "./policy.ts";
import { isSensitivePath } from "./redaction.ts";

export const READ_ALLOWLIST_ENV = "OPERATOR_SYNACIEL_MCP_READ_ALLOWLIST";
export const READ_PERMISSION_TTL_MS = 15 * 60 * 1_000;

const READ_ALLOWLIST_VERSION = 1;
const MAX_PERSISTED_PATHS = 200;
const MAX_TEMPORARY_GRANTS = 100;
const PROFILE_NAMES = Object.keys(REPOSITORY_WRITE_PROFILES) as RepositoryWriteProfile[];

type PersistedProfileAllowlist = Partial<Record<RepositoryWriteProfile, string[]>>;

type PersistedReadAllowlist = {
  readonly version: number;
  readonly roots: Record<string, PersistedProfileAllowlist>;
};

type TemporaryGrant = {
  readonly tokenHash: string;
  readonly profile: RepositoryWriteProfile;
  readonly paths: readonly string[];
  readonly expiresAt: number;
};

export type ReadPermissionScope = "temporary" | "permanent";

export type ReadPermissionGrant = {
  readonly scope: ReadPermissionScope;
  readonly paths: readonly string[];
  readonly permissionToken?: string;
  readonly expiresAt?: string;
};

export type RepositoryReadPermissionStore = {
  readonly isPermanentlyAllowed: (
    profile: RepositoryWriteProfile,
    path: string,
  ) => Promise<boolean>;
  readonly grant: (
    profile: RepositoryWriteProfile,
    paths: readonly string[],
    scope: ReadPermissionScope,
  ) => Promise<ReadPermissionGrant>;
  readonly coversTemporaryGrant: (
    profile: RepositoryWriteProfile,
    paths: readonly string[],
    permissionToken: string,
  ) => boolean;
  readonly consumeTemporaryGrant: (permissionToken: string) => void;
};

function emptyAllowlist(): PersistedReadAllowlist {
  return { version: READ_ALLOWLIST_VERSION, roots: {} };
}

function isInsideProjectRoot(candidate: string): boolean {
  const relativePath = relative(PROJECT_ROOT, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function resolveAllowlistPath(configPath?: string): string {
  const configured = configPath?.trim() || process.env[READ_ALLOWLIST_ENV]?.trim();
  const defaultConfigHome = process.env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  const selected =
    configured || join(defaultConfigHome, "operator-synaciel-repository", "read-allowlist.json");
  if (!isAbsolute(selected)) {
    throw new Error(`${READ_ALLOWLIST_ENV} must be an absolute path when configured.`);
  }
  const absolute = resolve(selected);
  if (isInsideProjectRoot(absolute)) {
    throw new Error("The repository read allowlist must live outside the checkout.");
  }
  return absolute;
}

function safeAllowlistedPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  try {
    const path = validateRelativeProjectPath(value, { allowRestrictedPaths: true });
    if (isLikelyBinaryPath(path) || isSensitivePath(path)) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

function parseAllowlist(value: unknown): PersistedReadAllowlist {
  if (!value || typeof value !== "object") return emptyAllowlist();
  const candidate = value as {
    readonly version?: unknown;
    readonly roots?: unknown;
  };
  if (candidate.version !== READ_ALLOWLIST_VERSION || !candidate.roots) return emptyAllowlist();
  if (typeof candidate.roots !== "object" || Array.isArray(candidate.roots)) {
    return emptyAllowlist();
  }

  const roots: Record<string, PersistedProfileAllowlist> = {};
  for (const [root, rawProfileAllowlist] of Object.entries(
    candidate.roots as Record<string, unknown>,
  )) {
    if (!rawProfileAllowlist || typeof rawProfileAllowlist !== "object") continue;
    const profileAllowlist: PersistedProfileAllowlist = {};
    for (const profile of PROFILE_NAMES) {
      const rawPaths = (rawProfileAllowlist as Record<string, unknown>)[profile];
      if (!Array.isArray(rawPaths)) continue;
      const paths = [...new Set(rawPaths.map(safeAllowlistedPath).filter(Boolean))] as string[];
      if (paths.length > 0) profileAllowlist[profile] = paths.slice(0, MAX_PERSISTED_PATHS);
    }
    if (Object.keys(profileAllowlist).length > 0) roots[root] = profileAllowlist;
  }
  return { version: READ_ALLOWLIST_VERSION, roots };
}

async function readAllowlist(configPath: string): Promise<PersistedReadAllowlist> {
  const info = await lstat(configPath).catch(() => null);
  if (!info) return emptyAllowlist();
  if (!info.isFile() || info.isSymbolicLink()) return emptyAllowlist();
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) return emptyAllowlist();
  const content = await readFile(configPath, "utf8").catch(() => "");
  if (!content) return emptyAllowlist();
  try {
    return parseAllowlist(JSON.parse(content) as unknown);
  } catch {
    return emptyAllowlist();
  }
}

async function ensureWritableAllowlistPath(configPath: string): Promise<void> {
  const parent = dirname(configPath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error("The repository read allowlist directory must be a real directory.");
  }
  if (process.platform !== "win32") await chmod(parent, 0o700);

  const fileInfo = await lstat(configPath).catch(() => null);
  if (fileInfo?.isSymbolicLink() || (fileInfo && !fileInfo.isFile())) {
    throw new Error("The repository read allowlist must be a regular file.");
  }
  if (fileInfo && process.platform !== "win32" && (fileInfo.mode & 0o077) !== 0) {
    throw new Error("The repository read allowlist must be owner-readable only.");
  }
}

const writeQueues = new Map<string, Promise<void>>();

async function withAllowlistWrite<T>(configPath: string, operation: () => Promise<T>): Promise<T> {
  const predecessor = writeQueues.get(configPath) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolveTurn) => {
    release = resolveTurn;
  });
  const queue = predecessor.then(() => turn);
  writeQueues.set(configPath, queue);
  await predecessor;
  try {
    return await operation();
  } finally {
    release();
    if (writeQueues.get(configPath) === queue) writeQueues.delete(configPath);
  }
}

async function writeAllowlist(configPath: string, value: PersistedReadAllowlist): Promise<void> {
  await ensureWritableAllowlistPath(configPath);
  const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    if (process.platform !== "win32") await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, configPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function pruneTemporaryGrants(grants: Map<string, TemporaryGrant>): void {
  const now = Date.now();
  for (const [hash, grant] of grants) {
    if (grant.expiresAt <= now) grants.delete(hash);
  }
  while (grants.size >= MAX_TEMPORARY_GRANTS) {
    const first = grants.keys().next().value;
    if (typeof first !== "string") break;
    grants.delete(first);
  }
}

export function createRepositoryReadPermissionStore(
  options: { readonly configPath?: string } = {},
): RepositoryReadPermissionStore {
  const configPath = resolveAllowlistPath(options.configPath);
  const temporaryGrants = new Map<string, TemporaryGrant>();
  let loaded: Promise<PersistedReadAllowlist> | null = null;

  const load = async (): Promise<PersistedReadAllowlist> => {
    loaded ??= readAllowlist(configPath);
    return loaded;
  };

  return {
    async isPermanentlyAllowed(profile, path) {
      const allowlist = await load();
      return allowlist.roots[PROJECT_ROOT]?.[profile]?.includes(path) ?? false;
    },

    async grant(profile, paths, scope) {
      const safePaths = [...new Set(paths.map(safeAllowlistedPath).filter(Boolean))] as string[];
      if (safePaths.length === 0) throw new Error("No safe repository paths were provided.");

      if (scope === "temporary") {
        pruneTemporaryGrants(temporaryGrants);
        const permissionToken = randomUUID();
        const expiresAt = Date.now() + READ_PERMISSION_TTL_MS;
        temporaryGrants.set(tokenHash(permissionToken), {
          tokenHash: tokenHash(permissionToken),
          profile,
          paths: safePaths,
          expiresAt,
        });
        return {
          scope,
          paths: safePaths,
          permissionToken,
          expiresAt: new Date(expiresAt).toISOString(),
        };
      }

      const current = await load();
      const currentRoot = current.roots[PROJECT_ROOT] ?? {};
      const currentPaths = currentRoot[profile] ?? [];
      const mergedPaths = [...new Set([...currentPaths, ...safePaths])];
      if (mergedPaths.length > MAX_PERSISTED_PATHS) {
        throw new Error(
          `The repository read allowlist cannot contain more than ${MAX_PERSISTED_PATHS} paths per profile.`,
        );
      }
      const next: PersistedReadAllowlist = {
        version: READ_ALLOWLIST_VERSION,
        roots: {
          ...current.roots,
          [PROJECT_ROOT]: {
            ...currentRoot,
            [profile]: mergedPaths,
          },
        },
      };
      await withAllowlistWrite(configPath, async () => writeAllowlist(configPath, next));
      loaded = Promise.resolve(next);
      return { scope, paths: safePaths };
    },

    coversTemporaryGrant(profile, paths, permissionToken) {
      pruneTemporaryGrants(temporaryGrants);
      const grant = temporaryGrants.get(tokenHash(permissionToken));
      if (!grant || grant.profile !== profile) return false;
      const grantedPaths = new Set(grant.paths);
      return paths.every((path) => grantedPaths.has(path));
    },

    consumeTemporaryGrant(permissionToken) {
      temporaryGrants.delete(tokenHash(permissionToken));
    },
  };
}
