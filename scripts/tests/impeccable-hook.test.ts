import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStopOutput,
  clearDeferredContext,
  extractAdditionalContext,
  queueDeferredContext,
  readDeferredContext,
} from "../../scripts/impeccable-hook.mjs";

test("extracts hook additional context and tolerates plain text", () => {
  const raw = JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "finding" },
  });

  assert.equal(extractAdditionalContext(raw), "finding");
  assert.equal(extractAdditionalContext("plain text"), "plain text");
  assert.equal(extractAdditionalContext(""), "");
});

test("defers post-edit findings and delivers them once at stop", async () => {
  const queueDirectory = await mkdtemp(join(tmpdir(), "impeccable-hook-"));
  const input = { session_id: "test-session", cwd: "/repo" };

  try {
    queueDeferredContext(
      input,
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "edit finding" },
      }),
      queueDirectory,
    );
    assert.deepEqual(readDeferredContext(input, queueDirectory), ["edit finding"]);

    const output = buildStopOutput(
      input,
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "Stop", additionalContext: "deep finding" },
      }),
      queueDirectory,
    );
    const parsed = JSON.parse(output);

    assert.equal(parsed.hookSpecificOutput.hookEventName, "Stop");
    assert.match(parsed.hookSpecificOutput.additionalContext, /edit finding/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /deep finding/);

    clearDeferredContext(input, queueDirectory);
    assert.deepEqual(readDeferredContext(input, queueDirectory), []);
  } finally {
    await rm(queueDirectory, { recursive: true, force: true });
  }
});

test("stays silent when nothing was queued or reported", async () => {
  const queueDirectory = await mkdtemp(join(tmpdir(), "impeccable-hook-"));
  const input = { session_id: "empty-session", cwd: "/repo" };

  try {
    queueDeferredContext(input, "", queueDirectory);
    assert.equal(buildStopOutput(input, "", queueDirectory), "");
  } finally {
    await rm(queueDirectory, { recursive: true, force: true });
  }
});
