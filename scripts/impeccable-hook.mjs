#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const impeccableLauncher = resolve(
  repositoryRoot,
  process.platform === "win32"
    ? ".agents/skills/impeccable/scripts/impeccable.cmd"
    : ".agents/skills/impeccable/scripts/impeccable",
);
const MAX_DEFERRED_CONTEXTS = 20;
const MAX_DEFERRED_CHARACTERS = 64_000;

export function extractAdditionalContext(rawOutput) {
  const raw = typeof rawOutput === "string" ? rawOutput.trim() : "";
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);
    const context = parsed?.hookSpecificOutput?.additionalContext;
    return typeof context === "string" ? context.trim() : "";
  } catch {
    return raw;
  }
}

function sessionKey(input) {
  const sessionId = typeof input?.session_id === "string" ? input.session_id.trim() : "";
  return createHash("sha256")
    .update(sessionId || `${process.ppid}:${input?.cwd ?? repositoryRoot}`)
    .digest("hex")
    .slice(0, 24);
}

export function deferredContextPath(input, queueDirectory = tmpdir()) {
  return join(queueDirectory, `impeccable-hook-${sessionKey(input)}.json`);
}

export function readDeferredContext(input, queueDirectory = tmpdir()) {
  try {
    const parsed = JSON.parse(readFileSync(deferredContextPath(input, queueDirectory), "utf8"));
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string" && value.trim())
      : [];
  } catch {
    return [];
  }
}

export function queueDeferredContext(input, rawOutput, queueDirectory = tmpdir()) {
  const context = extractAdditionalContext(rawOutput);
  if (!context) return "";

  const contexts = [...readDeferredContext(input, queueDirectory), context];
  let combined = contexts.join("\n\n");
  while (contexts.length > MAX_DEFERRED_CONTEXTS || combined.length > MAX_DEFERRED_CHARACTERS) {
    contexts.shift();
    combined = contexts.join("\n\n");
  }

  mkdirSync(queueDirectory, { recursive: true });
  writeFileSync(deferredContextPath(input, queueDirectory), JSON.stringify(contexts), "utf8");
  return context;
}

export function clearDeferredContext(input, queueDirectory = tmpdir()) {
  rmSync(deferredContextPath(input, queueDirectory), { force: true });
}

export function buildStopOutput(input, stopOutput, queueDirectory = tmpdir()) {
  const contexts = readDeferredContext(input, queueDirectory);
  const stopContext = extractAdditionalContext(stopOutput);
  if (stopContext) contexts.push(stopContext);
  if (contexts.length === 0) return "";

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: contexts.join("\n\n"),
    },
  });
}

export function runImpeccableHook(rawInput, { spawn = spawnSync, timeout = 20_000 } = {}) {
  try {
    const result = spawn(impeccableLauncher, ["hook"], {
      input: rawInput,
      encoding: "utf8",
      timeout,
      maxBuffer: 4 * 1024 * 1024,
      shell: false,
    });
    return typeof result.stdout === "string" ? result.stdout : "";
  } catch {
    return "";
  }
}

function parseHookInput(rawInput) {
  if (!rawInput.trim()) return {};

  try {
    const parsed = JSON.parse(rawInput);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const rawInput = await readStdin();
  const input = parseHookInput(rawInput);
  const eventName = String(input.hook_event_name ?? input.hookEventName ?? "PostToolUse");
  const isStop = eventName.toLowerCase() === "stop";

  if (isStop) {
    const stopOutput = runImpeccableHook(rawInput, { timeout: 60_000 });
    const output = buildStopOutput(input, stopOutput);
    clearDeferredContext(input);
    if (output) process.stdout.write(output);
  } else {
    const postOutput = runImpeccableHook(rawInput, { timeout: 20_000 });
    queueDeferredContext(input, postOutput);
    // PostToolUse stays silent so its context cannot land between a tool call and output.
  }
}
