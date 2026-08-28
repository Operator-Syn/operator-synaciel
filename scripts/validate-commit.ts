import { spawnSync } from "node:child_process";

import {
  COMMIT_APPROVAL_ENV,
  CONSENTABLE_RESTRICTED_DIRS,
} from "../tools/repository-mcp/src/policy.ts";

type GitResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type CommitValidationResult =
  | { readonly ok: true; readonly paths: readonly string[] }
  | { readonly ok: false; readonly message: string };

function runGit(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ""),
  };
}

export function stagedPaths(cwd = process.cwd()): readonly string[] {
  const result = runGit(cwd, ["diff", "--cached", "--name-only", "--no-renames", "-z"]);
  if (result.status !== 0) throw new Error(result.stderr || "Could not inspect the staged commit.");
  return result.stdout.split("\0").filter(Boolean);
}

export function isRestrictedPath(path: string): boolean {
  return path.split("/").some((part) => CONSENTABLE_RESTRICTED_DIRS.has(part));
}

export function validateStagedPaths(
  paths: readonly string[],
  approvalMarker = process.env[COMMIT_APPROVAL_ENV],
): CommitValidationResult {
  if (paths.length === 0) {
    return {
      ok: false,
      message: "Commit blocked: no staged paths were found. Use the guarded repository MCP.",
    };
  }
  if (paths.length !== 1) {
    return {
      ok: false,
      message: `Commit blocked: exactly one staged path is required, but ${paths.length} were found (${paths.join(", ")}). Use prepare_working_tree_commit and git_commit_working_tree for per-file commits.`,
    };
  }
  const restrictedPaths = paths.filter(isRestrictedPath);
  if (restrictedPaths.length > 0 && !approvalMarker?.trim()) {
    return {
      ok: false,
      message: `Commit blocked: restricted developer paths require explicit MCP consent (${restrictedPaths.join(", ")}).`,
    };
  }
  return { ok: true, paths };
}

export function validateCommit(
  cwd = process.cwd(),
  approvalMarker = process.env[COMMIT_APPROVAL_ENV],
): CommitValidationResult {
  return validateStagedPaths(stagedPaths(cwd), approvalMarker);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const result = validateCommit();
    if (!result.ok) {
      console.error(result.message);
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
