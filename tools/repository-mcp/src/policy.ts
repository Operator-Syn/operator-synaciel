export const MCP_SERVER_NAME = "operator-synaciel-repository";
export const MCP_SERVER_VERSION = "1.2.0";
export const COMMIT_APPROVAL_ENV = "OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL";
export const MCP_SERVER_INSTRUCTIONS =
  "Start with repository_workflow_status. Query Graphify narrowly with context_filter, shallow depth, and an explicit budget, then read the cited source directly. For planned changes, prepare complete source content with old hashes, review the bounded diff and read any remaining chunks, apply only with explicit approval, run the matching fixed verification profile, then commit through the guarded one-file pipeline. For dirty-tree commits, use prepare_working_tree_commit directly; use prepare_commits only after an applied-change operation. Never deploy, access Cloudflare credentials, apply D1 migrations, or perform remote Git operations through this server.";

export const MAX_PREPARED_FILES = 20;
export const MAX_DIFF_PREVIEW_CHARACTERS = 16_000;
export const MAX_DIFF_CHUNK_CHARACTERS = 64_000;
export const MAX_DIFF_STORAGE_CHARACTERS = 8_000_000;

export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-ssr",
  "build",
  "coverage",
  "target",
  ".wrangler",
  "graphify-out",
]);

export const CONSENTABLE_RESTRICTED_DIRS: ReadonlySet<string> = new Set([
  ".agents",
  ".codex",
  ".impeccable",
  ".obsidian",
]);

export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  ".7z",
  ".eot",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".svg",
  ".tar",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

export const REPOSITORY_WRITE_PROFILES = {
  app: {
    prefixes: ["apps/portfolio-web/"],
    maxFiles: 60,
    maxBytes: 500_000,
  },
  docs: {
    prefixes: ["docs/", "README.md", "AGENTS.md", "PRODUCT.md", "DESIGN.md", "screenshot.png.md"],
    maxFiles: 50,
    maxBytes: 400_000,
  },
  mcp: {
    prefixes: [
      "tools/repository-mcp/",
      "workers/portfolio-mcp/",
      "tests/",
      "scripts/",
      ".githooks/",
      ".codex/",
      ".agents/",
      ".impeccable/",
      ".obsidian/",
      "docs/",
      "README.md",
      "package.json",
      "package-lock.json",
      ".mcp.json",
      "skills-lock.json",
      "tsconfig.tests.json",
      "eslint.config.js",
    ],
    maxFiles: 80,
    maxBytes: 500_000,
  },
  database: {
    prefixes: [
      "workers/portfolio-api/migrations/",
      "workers/portfolio-api/src/db/",
      "workers/portfolio-api/src/data/Initial-Seed.sql",
      "workers/portfolio-api/drizzle.config.ts",
      "workers/portfolio-api/wrangler.toml",
    ],
    maxFiles: 30,
    maxBytes: 300_000,
  },
  config: {
    prefixes: [
      "package.json",
      "package-lock.json",
      ".mcp.json",
      ".impeccable/",
      "tsconfig.json",
      "tsconfig.tests.json",
      "eslint.config.js",
      "biome.json",
      "apps/portfolio-web/",
      "workers/portfolio-api/package.json",
      "workers/portfolio-api/tsconfig.json",
      "workers/portfolio-api/drizzle.config.ts",
      "workers/portfolio-mcp/",
      "tools/repository-mcp/",
      ".gitignore",
      ".vscode/",
      "docs/",
      "README.md",
      "scripts/",
      "tests/",
      ".graphifyignore",
      "Pipfile",
      "Pipfile.lock",
    ],
    maxFiles: 80,
    maxBytes: 300_000,
  },
} as const;

export type RepositoryWriteProfile = keyof typeof REPOSITORY_WRITE_PROFILES;

export const REPOSITORY_VERIFICATION_PROFILES = {
  app: ["typecheck", "lint", "build"],
  docs: ["docs_check"],
  mcp: ["mcp_config_check", "mcp_typecheck", "mcp_test", "lint"],
  database: ["docs_check", "migration_list_local"],
  config: ["mcp_config_check", "typecheck", "lint"],
  full: [
    "docs_check",
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "typecheck",
    "lint",
    "build",
  ],
} as const;

export type RepositoryVerificationProfile = keyof typeof REPOSITORY_VERIFICATION_PROFILES;
export type SafeVerificationCheck =
  (typeof REPOSITORY_VERIFICATION_PROFILES)[keyof typeof REPOSITORY_VERIFICATION_PROFILES][number];

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export const SAFE_VERIFICATION_COMMANDS: Record<SafeVerificationCheck, readonly string[]> = {
  typecheck: [npmCommand, "run", "typecheck"],
  lint: [npmCommand, "run", "lint"],
  build: [npmCommand, "run", "build"],
  docs_check: [npmCommand, "run", "docs:check"],
  mcp_config_check: [npmCommand, "run", "mcp:check"],
  mcp_typecheck: [npmCommand, "run", "mcp:typecheck"],
  mcp_test: [npmCommand, "run", "test:mcp"],
  migration_list_local: [npmCommand, "run", "db:migrations:list:local"],
};

export const LOCAL_ONLY_MCP_TOOLS = new Set([
  "repository_workflow_status",
  "prepare_repository_change",
  "apply_repository_change",
  "verify_repository_change",
  "read_repository_change_diff",
  "read_working_tree_diff",
  "prepare_working_tree_commit",
  "git_commit_working_tree",
  "prepare_commits",
  "git_commit_files",
]);
