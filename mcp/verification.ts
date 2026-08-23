import { spawnSync } from "node:child_process";
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
};

const MAX_OUTPUT_BYTES = 12_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function boundedOutput(stdout: string, stderr: string): string {
  const output = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
  return output.length <= MAX_OUTPUT_BYTES
    ? output
    : `${output.slice(0, MAX_OUTPUT_BYTES)}\n[output truncated]`;
}

export function runVerificationProfile(
  profile: RepositoryVerificationProfile,
  requestedChecks?: readonly SafeVerificationCheck[],
): VerificationSummary {
  const allowed = new Set<SafeVerificationCheck>(REPOSITORY_VERIFICATION_PROFILES[profile]);
  const checks = requestedChecks ?? [...allowed];
  for (const check of checks) {
    if (!allowed.has(check) || !SAFE_VERIFICATION_COMMANDS[check]) {
      throw new Error(`Verification check is not allowed by the ${profile} profile: ${check}`);
    }
  }

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

  return {
    profile,
    checks: results,
    passed: results.length > 0 && results.every((result) => result.passed),
  };
}
