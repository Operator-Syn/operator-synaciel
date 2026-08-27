import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

type GitResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

function runGit(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8", shell: false });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ""),
  };
}

export async function setupGitHooks(cwd = process.cwd()): Promise<string> {
  const rootResult = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (rootResult.status !== 0) {
    throw new Error(rootResult.stderr || "The current directory is not a Git repository.");
  }
  const root = rootResult.stdout.trim();
  const hooksDirectory = resolve(root, ".githooks");
  await access(resolve(hooksDirectory, "pre-commit"));
  await access(resolve(hooksDirectory, "pre-push"));

  const configured = runGit(root, ["config", "--local", "core.hooksPath", ".githooks"]);
  if (configured.status !== 0) {
    throw new Error(configured.stderr || "Could not configure the Git hook path.");
  }
  const verified = runGit(root, ["config", "--local", "--get", "core.hooksPath"]);
  if (verified.status !== 0 || verified.stdout.trim() !== ".githooks") {
    throw new Error("Git hook configuration could not be verified.");
  }
  return root;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  setupGitHooks()
    .then((root) => console.log(`Configured versioned Git hooks for ${root}.`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
