import { spawnSync } from "node:child_process";

/**
 * Versioned pre-commit policy: one path per commit, and explicit consent before
 * a restricted developer directory is committed.
 *
 * This module used to read those two constants from the retired local
 * repository MCP. They live here now so the hook stays self-contained while the
 * policy it enforces is unchanged.
 */

/** Environment variable a caller sets to consent to a restricted path commit. */
export const COMMIT_APPROVAL_ENV = "OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL";

/**
 * Directories whose contents are developer configuration rather than product
 * source. Committing one is allowed, but only with an explicit approval marker,
 * because such changes alter the tooling every contributor relies on.
 */
export const CONSENTABLE_RESTRICTED_DIRS: ReadonlySet<string> = new Set([
  ".agents",
  ".codex",
  ".impeccable",
  ".obsidian",
]);

type GitResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type CommitValidationResult =
  | { readonly ok: true; readonly paths: readonly string[] }
  | { readonly ok: false; readonly message: string };

/**
 * Runs one git command without a shell and captures every output channel.
 *
 * @param cwd Directory the command runs in.
 * @param args Git arguments, already split.
 * @returns Exit status plus stdout/stderr; a spawn failure reports status -1
 *   and the error text on stderr so callers can surface one message.
 */
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

/**
 * Lists the repository-relative paths staged for the next commit.
 *
 * Reads `git diff --cached --name-only -z` so paths containing spaces or
 * newlines survive intact; `--no-renames` keeps a rename visible as its two
 * sides rather than collapsing it into one path.
 *
 * @param cwd Repository directory to inspect.
 * @returns Staged paths, possibly empty.
 * @throws When git cannot read the index.
 */
export function stagedPaths(cwd = process.cwd()): readonly string[] {
  const result = runGit(cwd, ["diff", "--cached", "--name-only", "--no-renames", "-z"]);
  if (result.status !== 0) throw new Error(result.stderr || "Could not inspect the staged commit.");
  return result.stdout.split("\0").filter(Boolean);
}

/**
 * Reports whether a path sits inside a consentable restricted directory.
 *
 * Checks every segment, so a nested file such as `.codex/hooks/x.sh` is
 * restricted while `docs/.codex-guide.md` is not.
 *
 * @param path Repository-relative path.
 * @returns True when any path segment names a restricted directory.
 */
export function isRestrictedPath(path: string): boolean {
  return path.split("/").some((part) => CONSENTABLE_RESTRICTED_DIRS.has(part));
}

/**
 * Applies the one-file-per-commit and restricted-path consent rules.
 *
 * Algorithm:
 *   1. An empty staged set fails: there is nothing to commit and it usually
 *      means the caller staged nothing.
 *   2. More than one path fails: history stays auditable one path at a time.
 *   3. Any restricted path fails unless an approval marker is present.
 *   4. Otherwise the commit is allowed.
 *
 * @param paths Staged repository-relative paths.
 * @param approvalMarker Explicit consent value; absent means no consent.
 * @returns `{ ok: true, paths }` or `{ ok: false, message }` for the hook.
 */
export function validateStagedPaths(
  paths: readonly string[],
  approvalMarker = process.env[COMMIT_APPROVAL_ENV],
): CommitValidationResult {
  if (paths.length === 0) {
    return {
      ok: false,
      message: "Commit blocked: no staged paths were found. Stage exactly one path.",
    };
  }
  if (paths.length !== 1) {
    return {
      ok: false,
      message: `Commit blocked: exactly one staged path is required, but ${paths.length} were found (${paths.join(", ")}). Stage one path per commit.`,
    };
  }
  const restrictedPaths = paths.filter(isRestrictedPath);
  if (restrictedPaths.length > 0 && !approvalMarker?.trim()) {
    return {
      ok: false,
      message: `Commit blocked: restricted developer paths require explicit approval via ${COMMIT_APPROVAL_ENV} (${restrictedPaths.join(", ")}).`,
    };
  }
  return { ok: true, paths };
}

/**
 * Validates the repository's currently staged commit.
 *
 * @param cwd Repository directory to inspect.
 * @param approvalMarker Explicit consent value; defaults to the environment.
 * @returns The validation result for the staged paths.
 */
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
