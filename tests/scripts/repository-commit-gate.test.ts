import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const gateScript = resolve(repositoryRoot, ".codex/hooks/repository-commit-gate.mjs");

function runGate(command: string, toolName = "Bash"): string {
  const result = spawnSync(process.execPath, [gateScript], {
    cwd: repositoryRoot,
    input: `${JSON.stringify({ tool_name: toolName, tool_input: { command } })}\n`,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  return result.stdout;
}

test("detects direct commits and supported shell wrappers", () => {
  for (const command of [
    "git commit -m 'Update the fixture.'",
    "git --no-pager -C /tmp/project commit --quiet",
    "git -C /tmp/project commit --quiet",
    "bash -lc \"git commit -m 'Update the fixture.'\"",
    "env GIT_PAGER=cat git commit --quiet",
    "command git commit --quiet",
    "eval git commit --quiet",
    'eval "git commit --quiet"',
    "exec git commit --quiet",
  ]) {
    assert.match(runGate(command), /"permissionDecision":"deny"/, command);
  }
});

test("ignores quoted search text, echo output, and comments", () => {
  for (const command of [
    'rg -n "git commit" README.md',
    'rg -n "foo; git commit" README.md',
    "echo 'git commit -m not-a-command'",
    "# git commit -m commented-out",
    "git status --short",
  ]) {
    assert.equal(runGate(command), "", command);
  }
});

test("returns the synchronous deny decision only for Bash commit commands", () => {
  assert.equal(runGate("git commit", "Read"), "");
  assert.equal(runGate("git status"), "");
  assert.match(runGate("env FOO=bar git commit"), /"permissionDecision":"deny"/);
  const malformed = spawnSync(process.execPath, [gateScript], {
    cwd: repositoryRoot,
    input: "not-json\n",
    encoding: "utf8",
  });
  assert.equal(malformed.status, 0);
  assert.equal(malformed.stdout, "");
});

test("keeps the manifest commit gate synchronous and executable through its wrapper", async () => {
  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, ".codex/hooks.json"), "utf8"),
  ) as {
    hooks: {
      PreToolUse: Array<{
        matcher: string;
        hooks: Array<{ command: string; async?: boolean }>;
      }>;
    };
  };
  const entry = manifest.hooks.PreToolUse.find((candidate) => candidate.matcher === "Bash");
  const hook = entry?.hooks.find((candidate) =>
    candidate.command.includes("repository-commit-gate.mjs"),
  );
  assert.ok(hook);
  assert.equal(hook.async, undefined);

  const blocked = spawnSync("bash", ["-lc", hook.command], {
    cwd: repositoryRoot,
    input: `${JSON.stringify({ tool_name: "Bash", tool_input: { command: "bash -lc 'git commit -m x'" } })}\n`,
    encoding: "utf8",
  });
  assert.equal(blocked.status, 0);
  assert.match(blocked.stdout, /"permissionDecision":"deny"/);

  const allowed = spawnSync("bash", ["-lc", hook.command], {
    cwd: repositoryRoot,
    input: `${JSON.stringify({ tool_name: "Bash", tool_input: { command: 'rg -n "git commit" README.md' } })}\n`,
    encoding: "utf8",
  });
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, "");
});
