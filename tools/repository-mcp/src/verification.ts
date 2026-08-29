import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";

import { PROJECT_ROOT } from "./path.ts";
import {
  REPOSITORY_VERIFICATION_PROFILES,
  type RepositoryVerificationProfile,
  SAFE_VERIFICATION_COMMANDS,
  type SafeVerificationCheck,
} from "./policy.ts";

export type VerificationCheckResult = {
  readonly check: SafeVerificationCheck;
  readonly command: readonly string[];
  readonly status: number;
  readonly output: string;
  readonly passed: boolean;
};

export type VerificationSummary = {
  readonly profile: RepositoryVerificationProfile;
  readonly checks: readonly VerificationCheckResult[];
  readonly passed: boolean;
  readonly cached: boolean;
};

const MAX_OUTPUT_BYTES = 12_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const VERIFICATION_CACHE_TTL_MS = 30_000;
const MAX_VERIFICATION_CACHE_ENTRIES = 32;
const verificationCache = new Map<
  string,
  { readonly summary: VerificationSummary; readonly expiresAt: number }
>();

function boundedOutput(stdout: string, stderr: string): string {
  const output = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
  return output.length <= MAX_OUTPUT_BYTES
    ? output
    : `${output.slice(0, MAX_OUTPUT_BYTES)}\n[output truncated]`;
}

function repositoryFingerprint(): string | null {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
    shell: false,
  });
  const status = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--no-renames", "-z"],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
      shell: false,
    },
  );
  if (head.status !== 0 || status.status !== 0) return null;

  const dependencies = ["package-lock.json", "node_modules/.package-lock.json"]
    .map((path) => {
      const info = statSync(`${PROJECT_ROOT}/${path}`, { throwIfNoEntry: false });
      return `${path}:${info ? `${info.mtimeMs}:${info.size}` : "missing"}`;
    })
    .join("\0");

  return createHash("sha256")
    .update(`${head.stdout}\0${status.stdout}\0${dependencies}`)
    .digest("hex");
}

function pruneVerificationCache(): void {
  const now = Date.now();
  for (const [key, entry] of verificationCache) {
    if (entry.expiresAt <= now) verificationCache.delete(key);
  }
  while (verificationCache.size >= MAX_VERIFICATION_CACHE_ENTRIES) {
    const first = verificationCache.keys().next().value;
    if (!first) break;
    verificationCache.delete(first);
  }
}

export function clearVerificationCache(): void {
  verificationCache.clear();
}

export function runVerificationProfile(
  profile: RepositoryVerificationProfile,
  requestedChecks?: readonly SafeVerificationCheck[],
): VerificationSummary {
  const allowed = new Set<SafeVerificationCheck>(REPOSITORY_VERIFICATION_PROFILES[profile]);
  const checks = requestedChecks ? [...requestedChecks] : [...allowed];
  for (const check of checks) {
    if (!allowed.has(check) || !SAFE_VERIFICATION_COMMANDS[check]) {
      throw new Error(`Verification check is not allowed by the ${profile} profile: ${check}`);
    }
  }

  const fingerprint = repositoryFingerprint();
  const cacheKey = fingerprint ? [profile, ...checks, fingerprint].join("\0") : null;
  const cached = cacheKey ? verificationCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.summary, cached: true };
  }
  if (cached) verificationCache.delete(cacheKey as string);

  const results: VerificationCheckResult[] = [];
  for (const check of checks) {
    const command = SAFE_VERIFICATION_COMMANDS[check];
    const completed = spawnSync(command[0], command.slice(1), {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      shell: false,
    });
    const status = completed.status ?? -1;
    results.push({
      check,
      command,
      status,
      output: boundedOutput(
        completed.stdout ?? "",
        [completed.stderr ?? "", completed.error instanceof Error ? completed.error.message : ""]
          .filter(Boolean)
          .join("\n"),
      ),
      passed: status === 0,
    });
    if (status !== 0) break;
  }

  const summary: VerificationSummary = {
    profile,
    checks: results,
    passed: results.length > 0 && results.every((result) => result.passed),
    cached: false,
  };
  if (summary.passed && cacheKey) {
    pruneVerificationCache();
    verificationCache.set(cacheKey, {
      summary,
      expiresAt: Date.now() + VERIFICATION_CACHE_TTL_MS,
    });
  }
  return summary;
}
