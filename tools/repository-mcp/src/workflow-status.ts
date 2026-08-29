import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { PROJECT_ROOT, validateLocalProjectRoot } from "./path.ts";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  REPOSITORY_VERIFICATION_PROFILES,
  REPOSITORY_WRITE_PROFILES,
  STATUS_CACHE_TTL_MS,
} from "./policy.ts";

type FileReadiness = {
  readonly present: boolean;
  readonly executable?: boolean;
};

export type RepositoryWorkflowStatus = {
  readonly status: "ready" | "attention" | "blocked";
  readonly projectRoot: string;
  readonly server: {
    readonly name: string;
    readonly version: string;
  };
  readonly files: Readonly<Record<string, FileReadiness>>;
  readonly tooling: {
    readonly npm: boolean;
    readonly tsx: boolean;
    readonly pipenv: boolean;
    readonly graph: boolean;
  };
  readonly git: {
    readonly hooksPath: string | null;
    readonly hooksActive: boolean;
  };
  readonly capabilities: {
    readonly writeProfiles: readonly string[];
    readonly verificationProfiles: Readonly<Record<string, readonly string[]>>;
  };
  readonly warnings: readonly string[];
  readonly checkedAt: string;
  readonly cacheHit: boolean;
};

type StatusCache = {
  readonly value: RepositoryWorkflowStatus;
  readonly expiresAt: number;
};

let statusCache: StatusCache | null = null;

export function invalidateWorkflowStatusCache(): void {
  statusCache = null;
}

async function fileReadiness(relativePath: string, executable = false): Promise<FileReadiness> {
  const info = await stat(resolve(PROJECT_ROOT, relativePath)).catch(() => null);
  if (!info?.isFile()) return { present: false, ...(executable ? { executable: false } : {}) };
  return executable ? { present: true, executable: (info.mode & 0o111) !== 0 } : { present: true };
}

function commandAvailable(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 5_000,
    shell: false,
  });
  return result.status === 0;
}

function localGitHooksPath(): string | null {
  const result = spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
    shell: false,
  });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function hooksAreActive(
  hooksPath: string | null,
  files: Readonly<Record<string, FileReadiness>>,
): boolean {
  if (!hooksPath || isAbsolute(hooksPath)) return false;
  const resolved = resolve(PROJECT_ROOT, hooksPath);
  const relativePath = relative(PROJECT_ROOT, resolved);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return false;
  return (
    files[".githooks/pre-commit"]?.present === true &&
    files[".githooks/pre-commit"]?.executable === true &&
    files[".githooks/pre-push"]?.present === true &&
    files[".githooks/pre-push"]?.executable === true
  );
}

export async function getRepositoryWorkflowStatus(
  input: { readonly refresh?: boolean } = {},
): Promise<RepositoryWorkflowStatus> {
  const now = Date.now();
  if (!input.refresh && statusCache && statusCache.expiresAt > now) {
    return { ...statusCache.value, cacheHit: true };
  }

  const checkedAt = new Date().toISOString();
  const root = await validateLocalProjectRoot({ fresh: input.refresh === true });
  if (!root.valid) {
    const value: RepositoryWorkflowStatus = {
      status: "blocked",
      projectRoot: PROJECT_ROOT,
      server: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      files: {},
      tooling: { npm: false, tsx: false, pipenv: false, graph: false },
      git: { hooksPath: null, hooksActive: false },
      capabilities: {
        writeProfiles: Object.keys(REPOSITORY_WRITE_PROFILES),
        verificationProfiles: REPOSITORY_VERIFICATION_PROFILES,
      },
      warnings: [root.reason],
      checkedAt,
      cacheHit: false,
    };
    statusCache = { value, expiresAt: now + STATUS_CACHE_TTL_MS };
    return value;
  }

  const requiredPaths = [
    "package.json",
    "Pipfile",
    ".mcp.json",
    ".codex/config.toml",
    "docs/README.md",
    ".githooks/pre-commit",
    ".githooks/pre-push",
    ".agents/skills/repository-quality/SKILL.md",
    ".agents/skills/impeccable/SKILL.md",
    ".codex/skills/repository-quality/SKILL.md",
    ".impeccable/config.json",
    "PRODUCT.md",
    "graphify-out/graph.json",
    "node_modules/.bin/tsx",
  ];
  const entries = await Promise.all(
    requiredPaths.map(
      async (path) => [path, await fileReadiness(path, path.startsWith(".githooks/"))] as const,
    ),
  );
  const files = Object.fromEntries(entries) as Record<string, FileReadiness>;
  const hooksPath = localGitHooksPath();
  const tooling = {
    npm: commandAvailable(process.platform === "win32" ? "npm.cmd" : "npm"),
    tsx: files["node_modules/.bin/tsx"].present,
    pipenv: commandAvailable(process.platform === "win32" ? "pipenv.exe" : "pipenv"),
    graph: files["graphify-out/graph.json"].present,
  };
  const warnings: string[] = [];
  if (!tooling.tsx) warnings.push("Node dependencies are not installed; run npm install.");
  if (!tooling.pipenv)
    warnings.push("Pipenv is unavailable; install Pipenv before using Graphify.");
  if (!tooling.graph)
    warnings.push("Graphify output is missing; run pipenv run graphify update . --no-cluster.");
  if (!hooksAreActive(hooksPath, files))
    warnings.push("Versioned Git hooks are not active; run npm run setup:git-hooks.");
  if (!files[".mcp.json"].present || !files[".codex/config.toml"].present)
    warnings.push("One or more tracked MCP registrations are missing.");
  if (!files["docs/README.md"].present)
    warnings.push("The Obsidian vault index docs/README.md is missing.");
  if (!files[".agents/skills/repository-quality/SKILL.md"].present)
    warnings.push("The portable repository-quality skill is missing.");
  if (!files[".agents/skills/impeccable/SKILL.md"].present)
    warnings.push("The Impeccable design skill is missing.");
  if (!files[".impeccable/config.json"].present)
    warnings.push("Impeccable project configuration is missing; run the project hook setup.");
  if (!files["PRODUCT.md"].present)
    warnings.push("Impeccable product context is missing; run /impeccable init.");

  const value: RepositoryWorkflowStatus = {
    status: warnings.length === 0 ? "ready" : "attention",
    projectRoot: PROJECT_ROOT,
    server: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    files,
    tooling,
    git: { hooksPath, hooksActive: hooksAreActive(hooksPath, files) },
    capabilities: {
      writeProfiles: Object.keys(REPOSITORY_WRITE_PROFILES),
      verificationProfiles: REPOSITORY_VERIFICATION_PROFILES,
    },
    warnings,
    checkedAt,
    cacheHit: false,
  };
  statusCache = { value, expiresAt: Date.now() + STATUS_CACHE_TTL_MS };
  return value;
}
