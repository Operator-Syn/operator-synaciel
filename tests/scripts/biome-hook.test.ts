import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  BIOME_CHECK_COMMAND,
  buildBiomeHookFeedback,
  MAX_FEEDBACK_CHARS,
  MAX_TOOL_RESULT_CHARS,
  runBiomeCheck,
} from "../../scripts/check-biome-hook.mjs";

type SpawnInvocation = {
  readonly command: string;
  readonly argumentsList: readonly string[];
  readonly options: {
    readonly cwd: string;
    readonly encoding: "utf8";
  };
};

type HookHandler = {
  readonly command: string;
  readonly async?: boolean;
};

type HookEntry = {
  readonly matcher: string;
  readonly hooks: readonly HookHandler[];
};

type StopEntry = {
  readonly hooks: readonly HookHandler[];
};

type HooksManifest = {
  readonly hooks: {
    readonly PostToolUse: readonly HookEntry[];
    readonly Stop: readonly StopEntry[];
  };
};

test("runs the expected repository Biome command", () => {
  const invocation: SpawnInvocation[] = [];
  const result = runBiomeCheck({
    spawn(command, argumentsList, options) {
      invocation.push({ command, argumentsList, options });
      return { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.equal(invocation.length, 1);
  assert.equal(invocation[0]?.command, BIOME_CHECK_COMMAND[0]);
  assert.deepEqual(invocation[0]?.argumentsList, BIOME_CHECK_COMMAND.slice(1));
  assert.equal(invocation[0]?.options.encoding, "utf8");
  assert.equal(result.status, 0);
  assert.equal(result.output, "");
});

test("returns bounded model-visible feedback for a failed Biome check", () => {
  const diagnostic = "::error file=apps/portfolio-web/src/components/pages/aiPage/Ai.tsx::format";
  const result = runBiomeCheck({
    spawn() {
      return { status: 1, stdout: diagnostic, stderr: "formatter failed" };
    },
  });
  const feedback = buildBiomeHookFeedback({
    toolName: "mcp__operator_synaciel_repository__apply_repository_change",
    output: result.output,
    toolResponse: { status: "applied", finalFileHashes: { "apps/example.ts": "abc" } },
  });
  assert.equal(result.status, 1);
  assert.equal(feedback.decision, "block");
  assert.equal("hookSpecificOutput" in feedback, false);
  assert.match(feedback.reason, /"status":"applied"/);
  assert.match(feedback.reason, /"finalFileHashes"/);
  assert.match(feedback.reason, /check:biome:github/);
  assert.match(feedback.reason, /Fix the reported diagnostics/);
  assert.match(feedback.reason, /Ai\.tsx/);

  const truncated = buildBiomeHookFeedback({
    toolName: "apply_patch",
    output: "x".repeat(MAX_FEEDBACK_CHARS * 2),
  });
  assert.ok(truncated.reason.length < MAX_FEEDBACK_CHARS * 2);
  assert.match(truncated.reason, /output truncated/);

  const truncatedResult = buildBiomeHookFeedback({
    toolName: "apply_patch",
    output: "ok",
    toolResponse: "r".repeat(MAX_TOOL_RESULT_CHARS * 2),
  });
  assert.ok(truncatedResult.reason.length < MAX_TOOL_RESULT_CHARS * 2);
  assert.match(truncatedResult.reason, /tool result truncated/);
});

test("keeps the Codex matcher and current Ai page regression covered", async () => {
  const [manifestSource, aiPage] = await Promise.all([
    readFile(new URL(".codex/hooks.json", new URL("../../", import.meta.url)), "utf8"),
    readFile(
      new URL(
        "apps/portfolio-web/src/components/pages/aiPage/Ai.tsx",
        new URL("../../", import.meta.url),
      ),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(manifestSource) as HooksManifest;
  const biomeEntry = manifest.hooks.PostToolUse.find((entry) =>
    entry.hooks.some((hook) => hook.command.includes("check-biome-hook.mjs")),
  );
  const biomeHook = biomeEntry?.hooks.find((hook) => hook.command.includes("check-biome-hook.mjs"));

  assert.ok(biomeEntry);
  assert.ok(
    manifest.hooks.PostToolUse.some((entry) =>
      entry.hooks.some((hook) => hook.command.includes("check-docs.mjs --hook")),
    ),
  );
  assert.ok(
    manifest.hooks.PostToolUse.some((entry) =>
      entry.hooks.some((hook) => hook.command.includes("scripts/impeccable-hook.mjs")),
    ),
  );
  assert.ok(
    manifest.hooks.Stop.some((entry) =>
      entry.hooks.some((hook) => hook.command.includes("scripts/impeccable-hook.mjs")),
    ),
  );
  assert.match(biomeEntry.matcher, /apply_patch/);
  assert.match(biomeEntry.matcher, /mcp__operator_synaciel_repository__apply_repository_change/);
  assert.ok(biomeHook);
  assert.equal(biomeHook.async, undefined);

  assert.match(aiPage, /<pre className="ai-page-prompt">/);
  assert.doesNotMatch(aiPage, /aria-label="Prompt for registering/);
  assert.doesNotMatch(aiPage, /role="status"/);
});
