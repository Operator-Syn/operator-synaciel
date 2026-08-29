#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const launcherRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function canonicalPath(path) {
  return realpathSync(path);
}

function isInside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function resolveRepositoryRoot({ anchor = process.cwd(), launcher = launcherRoot } = {}) {
  let canonicalAnchor;
  let canonicalLauncher;
  try {
    canonicalAnchor = canonicalPath(anchor);
    canonicalLauncher = canonicalPath(launcher);
  } catch {
    throw new Error("MCP launcher anchor or launcher directory does not exist.");
  }

  const result = spawnSync("git", ["-C", canonicalAnchor, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error("MCP launcher requires a Git checkout; no repository root was found.");
  }

  let root;
  try {
    root = canonicalPath(result.stdout.trim());
  } catch {
    throw new Error("Git returned a repository root that could not be canonicalized.");
  }
  if (!isInside(root, canonicalAnchor))
    throw new Error("The active directory is outside the resolved Git root.");
  if (!isInside(root, canonicalLauncher))
    throw new Error("The MCP launcher is not located inside the active Git root.");
  return root;
}

function requirePath(path, message) {
  if (!existsSync(path)) throw new Error(message);
}

function requireExecutable(path, message) {
  requirePath(path, message);
  try {
    accessSync(path, constants.X_OK);
  } catch {
    if (process.platform !== "win32") throw new Error(message);
  }
}

export function buildLaunchSpec(root, mode, options = {}) {
  if (mode === "repository") {
    const useCompiled = options.compiled ?? process.env.OPERATOR_SYNACIEL_MCP_COMPILED === "1";
    const entry = useCompiled
      ? resolve(root, "tools", "repository-mcp", "dist", "server.js")
      : resolve(root, "tools", "repository-mcp", "src", "server.ts");
    const runner = useCompiled
      ? process.execPath
      : resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
    return {
      command: runner,
      args: [entry],
      env: {
        OPERATOR_SYNACIEL_MCP_ROOT: root,
        ...(useCompiled ? { OPERATOR_SYNACIEL_MCP_COMPILED: "1" } : {}),
      },
      required: [
        { path: resolve(root, "package.json"), message: "Repository MCP requires package.json." },
        {
          path: entry,
          message: useCompiled
            ? "Compiled repository MCP output is missing; run npm run mcp:build first."
            : "Repository MCP entrypoint is missing.",
        },
        ...(useCompiled
          ? []
          : [
              {
                path: runner,
                message: "Repository MCP dependencies are missing; run npm install first.",
                executable: true,
              },
            ]),
      ],
    };
  }

  if (mode === "graphify") {
    const pipenv = process.platform === "win32" ? "pipenv.exe" : "pipenv";
    return {
      command: pipenv,
      args: ["run", "python", "-m", "graphify.serve", resolve(root, "graphify-out", "graph.json")],
      env: {},
      required: [
        { path: resolve(root, "Pipfile"), message: "Graphify requires Pipfile." },
        {
          path: resolve(root, "graphify-out", "graph.json"),
          message:
            "Graphify graph is missing; run pipenv install --dev --deploy and pipenv run graphify update . --no-cluster first.",
        },
      ],
    };
  }

  throw new Error(`Unknown MCP launcher mode: ${mode || "(missing)"}. Use repository or graphify.`);
}

function validateLaunchSpec(spec) {
  for (const requirement of spec.required) {
    if (requirement.executable) requireExecutable(requirement.path, requirement.message);
    else requirePath(requirement.path, requirement.message);
  }
}

export function launch(mode) {
  const root = resolveRepositoryRoot();
  const spec = buildLaunchSpec(root, mode);
  validateLaunchSpec(spec);
  const child = spawn(spec.command, spec.args, {
    cwd: root,
    env: { ...process.env, ...spec.env },
    shell: false,
    stdio: "inherit",
  });
  child.once("error", (error) => {
    console.error(`MCP server could not start: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    launch(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
