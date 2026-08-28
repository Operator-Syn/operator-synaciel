#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedServers = ["graphify", "operator-synaciel-repository"];
const launcherNeedle = "rev-parse --show-toplevel";

async function read(relativePath) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

function checkLauncherArgs(entry, mode, errors, source) {
  if (entry?.command !== "bash") errors.push(`${source} must use bash for root-safe launch.`);
  if (!Array.isArray(entry?.args) || entry.args.length !== 2) {
    errors.push(`${source} must provide exactly one bash command.`);
    return;
  }
  const command = entry.args[1];
  if (typeof command !== "string" || !command.includes(launcherNeedle)) {
    errors.push(`${source} must resolve the Git root at runtime.`);
  }
  if (!command?.includes('cd "$root"')) {
    errors.push(`${source} must enter the resolved Git root before launching.`);
  }
  if (!command?.includes(`scripts/mcp-launcher.mjs" ${mode}`)) {
    errors.push(`${source} must launch the ${mode} mode through scripts/mcp-launcher.mjs.`);
  }
}

export async function checkMcpConfig() {
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(await read(".mcp.json"));
  } catch (error) {
    errors.push(
      `Could not parse .mcp.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const servers = manifest?.mcpServers;
  if (!servers || typeof servers !== "object") {
    errors.push(".mcp.json must contain an mcpServers object.");
  } else {
    const actualServers = Object.keys(servers).sort();
    if (JSON.stringify(actualServers) !== JSON.stringify([...expectedServers].sort())) {
      errors.push(`.mcp.json must register exactly: ${expectedServers.join(", ")}.`);
    }
    checkLauncherArgs(servers?.graphify, "graphify", errors, ".mcp.json graphify");
    checkLauncherArgs(
      servers?.["operator-synaciel-repository"],
      "repository",
      errors,
      ".mcp.json repository",
    );
  }

  const codex = await read(".codex/config.toml").catch((error) => {
    errors.push(
      `Could not read .codex/config.toml: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  });
  if (!codex.includes(launcherNeedle))
    errors.push(".codex/config.toml must resolve the Git root at runtime.");
  if (!codex.includes("CLAUDE_PROJECT_DIR"))
    errors.push(".codex/config.toml must support a client-provided project root.");
  if (!codex.includes("scripts/mcp-launcher.mjs") || !codex.includes("graphify"))
    errors.push("Codex Graphify registration must use the shared launcher.");
  if (!codex.includes("scripts/mcp-launcher.mjs") || !codex.includes("repository"))
    errors.push("Codex repository registration must use the shared launcher.");
  if (!codex.includes('default_tools_approval_mode = "writes"'))
    errors.push("Codex repository MCP must default to writes approval.");
  if (!codex.includes("repository_workflow_status"))
    errors.push("Codex repository tool allowlist must include repository_workflow_status.");

  const codexHooks = await read(".codex/hooks.json").catch((error) => {
    errors.push(
      `Could not read .codex/hooks.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  });
  if (
    !codexHooks.includes("impeccable/scripts/hook.mjs") ||
    !codexHooks.includes(launcherNeedle) ||
    !codexHooks.includes("root=")
  ) {
    errors.push("Codex Impeccable hooks must resolve the Git root at runtime.");
  }
  if (
    !codexHooks.includes("check-biome-hook.mjs") ||
    !codexHooks.includes("mcp__operator_synaciel_repository__apply_repository_change") ||
    !codexHooks.includes("additionalContextLimit")
  ) {
    errors.push(
      "Codex PostToolUse hooks must provide repository Biome feedback after edits and MCP applies.",
    );
  }

  const launcher = await read("scripts/mcp-launcher.mjs").catch(() => "");
  if (!launcher) errors.push("scripts/mcp-launcher.mjs is required.");
  const forbiddenAbsolutePath = /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)/;
  const manifestText = manifest ? JSON.stringify(manifest) : "";
  for (const [source, content] of [
    [".mcp.json", manifestText],
    [".codex/config.toml", codex],
    [".codex/hooks.json", codexHooks],
  ]) {
    if (forbiddenAbsolutePath.test(content) || content.includes(repositoryRoot)) {
      errors.push(`${source} contains a machine-specific absolute path.`);
    }
  }

  for (const required of [
    ".githooks/pre-commit",
    ".githooks/pre-push",
    "docs/README.md",
    ".agents/skills/repository-quality/SKILL.md",
    ".agents/skills/impeccable/SKILL.md",
    ".codex/skills/repository-quality/SKILL.md",
    ".impeccable/config.json",
    "PRODUCT.md",
  ]) {
    const present = await read(required)
      .then(() => true)
      .catch(() => false);
    if (!present) errors.push(`${required} is required by the repository workflow.`);
  }

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkMcpConfig();
  if (!result.ok) {
    console.error(result.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("MCP configuration is clone-safe.");
  }
}
