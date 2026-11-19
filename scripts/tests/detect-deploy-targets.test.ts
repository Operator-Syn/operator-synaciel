import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

/**
 * Behavioural coverage for scripts/detect-deploy-targets.mjs.
 *
 * The gate decides which production Workers are deployed, so its failure modes
 * matter more than its happy path. Each test builds a throwaway git repository,
 * manipulates the deploy-* ledger tags, runs the real CLI against it, and reads
 * the decisions back out of $GITHUB_OUTPUT exactly as the workflow does.
 */

const gateScript = resolve(import.meta.dirname, "../../scripts/detect-deploy-targets.mjs");

/** Worker workspaces the gate knows about, each seeded with one file. */
const WORKSPACES = [
  "workers/portfolio-api",
  "workers/portfolio-mcp",
  "workers/portfolio-agent",
  "workers/portfolio-public-auth",
];

/** Every ledger tag the gate reads. */
const LEDGER_TAGS = [
  "deploy-portfolio-api",
  "deploy-portfolio-mcp",
  "deploy-portfolio-agent",
  "deploy-portfolio-public-auth",
];

let repository: string;
let gateOutput: string;

/**
 * Runs a git command inside the scratch repository.
 *
 * @param {...string} args - Arguments passed to git.
 * @returns {string} Trimmed stdout.
 */
function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

/**
 * Moves every ledger tag onto HEAD, simulating four successful deploys.
 *
 * @returns {void}
 */
function tagEveryWorkerAtHead(): void {
  for (const tag of LEDGER_TAGS) git("tag", "--force", tag, "HEAD");
}

/**
 * Runs the gate CLI and returns its decisions as a target-to-boolean map.
 *
 * Passes $GITHUB_OUTPUT so the test reads the same channel the workflow reads,
 * and pins FORCE_DEPLOY unless the caller overrides it. The output file lives
 * outside the repository so it never dirties a commit.
 *
 * @param {Record<string, string>} env - Extra environment for the CLI.
 * @returns {Record<string, boolean>} One decision per Worker.
 */
function runGate(env: Record<string, string> = {}): Record<string, boolean> {
  writeFileSync(gateOutput, "");

  execFileSync(process.execPath, [gateScript], {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, FORCE_DEPLOY: "false", GITHUB_OUTPUT: gateOutput, ...env },
  });

  const decisions: Record<string, boolean> = {};
  for (const line of readFileSync(gateOutput, "utf8").trim().split("\n").filter(Boolean)) {
    const [target, value] = line.split("=");
    decisions[target as string] = value === "true";
  }
  return decisions;
}

before(() => {
  repository = mkdtempSync(join(tmpdir(), "deploy-gate-"));
  gateOutput = join(mkdtempSync(join(tmpdir(), "deploy-gate-output-")), "output.txt");

  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.email", "gate@example.com");
  git("config", "user.name", "Deploy gate");
  git("config", "commit.gpgsign", "false");

  for (const workspace of WORKSPACES) {
    mkdirSync(join(repository, workspace), { recursive: true });
    writeFileSync(join(repository, workspace, "worker.ts"), "export const version = 1;\n");
    mkdirSync(join(repository, workspace, "tests"), { recursive: true });
    writeFileSync(
      join(repository, workspace, "tests", "worker.test.ts"),
      "export const covers = 1;\n",
    );
  }
  mkdirSync(join(repository, "apps/portfolio-web/tests"), { recursive: true });
  writeFileSync(
    join(repository, "apps/portfolio-web/tests/homepage.test.ts"),
    "export const covers = 1;\n",
  );
  writeFileSync(join(repository, "package-lock.json"), "{}\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "initial");
});

after(() => {
  rmSync(repository, { recursive: true, force: true });
  rmSync(gateOutput, { force: true });
});

test("deploys every Worker while no ledger tag exists", () => {
  assert.deepEqual(runGate(), { api: true, mcp: true, agent: true, public_auth: true });
});

test("skips every Worker once each ledger tag matches HEAD", () => {
  tagEveryWorkerAtHead();

  assert.deepEqual(runGate(), { api: false, mcp: false, agent: false, public_auth: false });
});

test("deploys only the Worker whose workspace changed", () => {
  writeFileSync(join(repository, "workers/portfolio-api/worker.ts"), "export const version = 2;\n");
  git("commit", "--quiet", "-am", "api change");

  assert.deepEqual(runGate(), { api: true, mcp: false, agent: false, public_auth: false });
});

test("retries a Worker whose last deploy never advanced past a change", () => {
  // Simulates a deploy that failed: the workspace moved on but the ledger tag
  // stayed behind, so an unrelated later push must still redeploy the API.
  git("tag", "--force", "deploy-portfolio-api", "HEAD~1");
  writeFileSync(join(repository, "README.md"), "unrelated\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "docs only");

  assert.deepEqual(runGate(), { api: true, mcp: false, agent: false, public_auth: false });
});

test("settles once the retried deploy advances its ledger tag", () => {
  git("tag", "--force", "deploy-portfolio-api", "HEAD");

  assert.deepEqual(runGate(), { api: false, mcp: false, agent: false, public_auth: false });
});

test("deploys every Worker when the lockfile changes", () => {
  writeFileSync(join(repository, "package-lock.json"), "{}\n\n");
  git("commit", "--quiet", "-am", "lockfile");

  assert.deepEqual(runGate(), { api: true, mcp: true, agent: true, public_auth: true });
});

test("honours FORCE_DEPLOY over an otherwise clean ledger", () => {
  tagEveryWorkerAtHead();

  assert.deepEqual(runGate({ FORCE_DEPLOY: "true" }), {
    api: true,
    mcp: true,
    agent: true,
    public_auth: true,
  });
});

test("ignores test-only changes in Worker and app workspaces", () => {
  for (const workspace of WORKSPACES) {
    writeFileSync(
      join(repository, workspace, "tests", "worker.test.ts"),
      "export const covers = 2;\n",
    );
  }
  writeFileSync(
    join(repository, "apps/portfolio-web/tests/homepage.test.ts"),
    "export const covers = 2;\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "test-only changes");

  assert.deepEqual(runGate(), { api: false, mcp: false, agent: false, public_auth: false });
});

test("--tags lists every ledger tag the workflow must fetch", () => {
  const listed = execFileSync(process.execPath, [gateScript, "--tags"], {
    cwd: repository,
    encoding: "utf8",
  })
    .trim()
    .split("\n");

  assert.deepEqual(listed, LEDGER_TAGS);
});
