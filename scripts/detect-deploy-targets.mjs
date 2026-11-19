#!/usr/bin/env node
/**
 * Decides which production Workers need a deploy on this run.
 *
 * The question this answers is "is production stale?", not "did this push touch
 * the workspace?". A push-scoped gate cannot notice a deploy that failed on an
 * earlier push, so production keeps serving an old bundle until somebody
 * remembers to land a change in that workspace. This gate instead compares each
 * Worker's last *successful* deploy commit against HEAD, so a failed deploy
 * leaves its ledger entry untouched and the next run retries it even when that
 * run touches nothing related.
 *
 * Ledger: one git tag per target, force-moved to the deployed commit after each
 * successful deploy. Tags are the storage because they need no extra service, no
 * credential beyond the workflow token, and stay inspectable in the repository
 * with `git tag -l 'deploy-*'`.
 *
 * Algorithm, per target:
 *   1. Read the target's tag. If it does not exist, deploy: nothing is recorded
 *      as having been released, so the first release must still happen.
 *   2. Otherwise list the files differing between the tagged commit and HEAD,
 *      restricted to the paths that can change that Worker's bundle.
 *   3. Deploy when that list is non-empty, skip when it is empty.
 * Any failure while reading git state deploys rather than skips. An unnecessary
 * deploy costs a couple of minutes on a free public runner; a skipped deploy
 * ships stale code to production.
 *
 * Writes `<target>=true|false` lines to stdout and, when running under GitHub
 * Actions, appends them to $GITHUB_OUTPUT.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * Every deployable Worker, the tag that records its last successful release,
 * and the paths whose changes can alter the bundle it ships.
 *
 * `package-lock.json` belongs to every target because a dependency change
 * rewrites all four bundles, even though it lives outside each workspace.
 */
const DEPLOY_TARGETS = [
  {
    target: "api",
    tag: "deploy-portfolio-api",
    paths: ["workers/portfolio-api", "package-lock.json"],
  },
  {
    target: "mcp",
    tag: "deploy-portfolio-mcp",
    paths: ["workers/portfolio-mcp", "package-lock.json"],
  },
  {
    target: "agent",
    tag: "deploy-portfolio-agent",
    paths: ["workers/portfolio-agent", "package-lock.json"],
  },
  {
    target: "public_auth",
    tag: "deploy-portfolio-public-auth",
    paths: ["workers/portfolio-public-auth", "package-lock.json"],
  },
];

/**
 * Runs a git command and returns its trimmed stdout.
 *
 * @param {string[]} args - Arguments passed to git.
 * @returns {string} Trimmed stdout.
 * @throws When git exits non-zero.
 */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Reports whether a tag exists in the local clone.
 *
 * Uses `rev-parse --verify --quiet`, which exits non-zero instead of printing
 * when the ref is absent, so a missing tag is a normal answer rather than an
 * error.
 *
 * @param {string} tag - Tag name to look for.
 * @returns {boolean} True when the tag resolves to a commit.
 */
function tagExists(tag) {
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists the files that differ between the tagged commit and HEAD, limited to the
 * paths that can change a Worker's bundle.
 *
 * `git diff A B -- paths` needs only the two trees, not a path of ancestry
 * between them, which is why a shallow clone that contains the tag commit and
 * HEAD is enough to answer this.
 *
 * @param {string} tag - Tag naming the last successfully deployed commit.
 * @param {string[]} paths - Path prefixes to restrict the diff to.
 * @returns {string[]} Changed paths, empty when the Worker is up to date.
 */
function changedSince(tag, paths) {
  const output = git(["diff", "--name-only", `refs/tags/${tag}`, "HEAD", "--", ...paths]);
  return output === "" ? [] : output.split("\n");
}

/**
 * Resolves the deploy decision for every target.
 *
 * @param {{force?: boolean}} options - `force` marks every target for deploy.
 * @returns {{target: string, deploy: boolean, reason: string}[]} One decision per
 *   target, in declaration order.
 */
function detectDeployTargets({ force = false } = {}) {
  return DEPLOY_TARGETS.map(({ target, tag, paths }) => {
    if (force) return { target, deploy: true, reason: "forced by workflow input" };
    if (!tagExists(tag)) return { target, deploy: true, reason: `no ${tag} tag yet` };

    let changed;
    try {
      changed = changedSince(tag, paths);
    } catch (error) {
      return { target, deploy: true, reason: `could not read ${tag}: ${error.message}` };
    }

    return changed.length > 0
      ? { target, deploy: true, reason: `${changed.length} change(s) since ${tag}` }
      : { target, deploy: false, reason: `unchanged since ${tag}` };
  });
}

/**
 * Runs the gate and publishes its decisions.
 *
 * `--tags` prints just the ledger tag names, one per line, so the workflow can
 * fetch them without restating the list and drifting from this file. Otherwise
 * decisions go to stdout for the workflow log and, when $GITHUB_OUTPUT is set,
 * to that file so later jobs can read them through job outputs.
 *
 * @returns {void}
 */
function main() {
  if (process.argv.includes("--tags")) {
    for (const { tag } of DEPLOY_TARGETS) console.log(tag);
    return;
  }

  const force = process.env.FORCE_DEPLOY === "true";
  const decisions = detectDeployTargets({ force });
  const lines = decisions.map(({ target, deploy }) => `${target}=${deploy}`);

  for (const decision of decisions) {
    const verdict = decision.deploy ? "deploy" : "skip";
    console.log(`${decision.target}: ${verdict} (${decision.reason})`);
  }

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  }
}

// Only run the CLI when invoked directly, so tests can import the module.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
