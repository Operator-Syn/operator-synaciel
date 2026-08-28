#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BIOME_CHECK_COMMAND = ["npm", "run", "check:biome:github"];
export const MAX_FEEDBACK_CHARS = 12_000;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function displayToolName(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : "the repository operation";
}

function truncateFeedback(value) {
  if (value.length <= MAX_FEEDBACK_CHARS) return value;

  const marker = "\n... Biome hook output truncated; rerun the check for the complete report ...\n";
  const available = MAX_FEEDBACK_CHARS - marker.length;
  const headLength = Math.ceil(available * 0.65);
  const tailLength = available - headLength;
  return value.slice(0, headLength) + marker + value.slice(-tailLength);
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

export function runBiomeCheck({ cwd = repositoryRoot, spawn = spawnSync } = {}) {
  try {
    const [command, ...argumentsList] = BIOME_CHECK_COMMAND;
    const result = spawn(command, argumentsList, {
      cwd,
      encoding: "utf8",
    });
    const output = [result.stdout, result.stderr, result.error?.message]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join("\n")
      .trim();

    return {
      status: typeof result.status === "number" ? result.status : 1,
      output,
    };
  } catch (error) {
    return {
      status: 1,
      output: error instanceof Error ? error.message : "The Biome hook could not start.",
    };
  }
}

export function buildBiomeHookFeedback({ toolName, output }) {
  const shownToolName = displayToolName(toolName);
  const diagnostics = truncateFeedback(
    typeof output === "string" && output.trim()
      ? output.trim()
      : "Biome returned no diagnostic output.",
  );

  return {
    decision: "block",
    reason:
      "Biome check failed after " +
      shownToolName +
      ". Fix the reported diagnostics before continuing.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        `Biome failed after ${shownToolName}. The operation already completed; do not repeat it blindly.`,
        "Fix the reported diagnostics, then rerun npm run check:biome:github.",
        "Continue the original task after the check passes.",
        "",
        diagnostics,
      ].join("\n"),
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const input = parseHookInput(await readStdin());
  const result = runBiomeCheck();

  if (result.status !== 0) {
    process.stdout.write(
      JSON.stringify(
        buildBiomeHookFeedback({
          toolName: input.tool_name,
          output: result.output,
        }),
      ),
    );
  }
}
