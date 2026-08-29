export const MCP_SERVER_NAME = "operator-synaciel-repository";
export const MCP_SERVER_VERSION = "1.4.0";
export const COMMIT_APPROVAL_ENV = "OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL";
export const MCP_SERVER_INSTRUCTIONS =
  "Start with repository_workflow_status and use the cached status when appropriate. Query Graphify narrowly with context_filter, shallow depth, and an explicit budget, then read the cited source directly. Use the repository profile for cross-workspace source snapshots and planned changes; use focused profiles when a narrower scope is sufficient. For fast MCP iteration, use the fixed mcp-fast verification profile and its cache; run the complete matching profile before commit. Use read_repository_files for bounded batches of complete source snapshots. For planned changes, prepare complete source content with old hashes, review every bounded diff chunk, apply only with explicit approval, then commit through the guarded one-file pipeline. Use responseMode structured when a client already consumes structuredContent. For dirty-tree commits, use prepare_working_tree_commit directly; use prepare_commits only after an applied-change operation. The source launcher is default; set OPERATOR_SYNACIEL_MCP_COMPILED=1 only after npm run mcp:build. Never deploy, access Cloudflare credentials, apply D1 migrations, or perform remote Git operations through this server.";

export const MAX_PREPARED_FILES = 20;
export const MAX_DIFF_PREVIEW_CHARACTERS = 16_000;
export const MAX_DIFF_CHUNK_CHARACTERS = 64_000;
export const MAX_DIFF_STORAGE_CHARACTERS = 8_000_000;
export const DEFAULT_SOURCE_READ_CHUNK_CHARACTERS = 16_000;
export const MAX_SOURCE_READ_CHUNK_CHARACTERS = 64_000;
export const MAX_SOURCE_READ_RESPONSE_CHARACTERS = 256_000;
export const MAX_RETAINED_REVIEW_BYTES = 64 * 1024 * 1024;
export const MAX_VERIFICATION_CHECKS = 20;
export const STATUS_CACHE_TTL_MS = 2_000;
export const ROOT_VALIDATION_CACHE_TTL_MS = 5_000;

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
      ".github/workflows/",
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
    maxBytes: 1_000_000,
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
      ".github/workflows/",
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
    maxBytes: 1_000_000,
  },
  repository: {
    prefixes: [
      "apps/",
      "workers/",
      "tools/",
      "tests/",
      "scripts/",
      "docs/",
      ".github/",
      ".githooks/",
      ".codex/",
      ".agents/",
      ".impeccable/",
      ".obsidian/",
      ".vscode/",
      ".gitignore",
      ".graphifyignore",
      ".mcp.json",
      "AGENTS.md",
      "DESIGN.md",
      "PRODUCT.md",
      "Pipfile",
      "Pipfile.lock",
      "README.md",
      "biome.json",
      "eslint.config.js",
      "package-lock.json",
      "package.json",
      "skills-lock.json",
      "tsconfig.json",
      "tsconfig.tests.json",
    ],
    maxFiles: 80,
    maxBytes: 1_000_000,
  },
} as const;

export type RepositoryWriteProfile = keyof typeof REPOSITORY_WRITE_PROFILES;

export function isProfilePathAllowed(profile: RepositoryWriteProfile, path: string): boolean {
  return REPOSITORY_WRITE_PROFILES[profile].prefixes.some((prefix) =>
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
  );
}

export const REPOSITORY_VERIFICATION_PROFILES = {
  "mcp-fast": ["mcp_config_check", "mcp_typecheck"],
  app: ["typecheck", "lint", "biome_check", "build", "web_test"],
  docs: ["docs_check"],
  mcp: [
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "portfolio_mcp_typecheck",
    "portfolio_mcp_test",
    "docs_check",
    "skills_check",
    "lint",
    "biome_check",
  ],
  database: [
    "docs_check",
    "db_migration_check",
    "migration_list_local",
    "api_typecheck",
    "api_test",
  ],
  config: ["mcp_config_check", "typecheck", "lint", "biome_check"],
  repository: [
    "docs_check",
    "skills_check",
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "portfolio_mcp_typecheck",
    "portfolio_mcp_test",
    "api_typecheck",
    "api_test",
    "web_test",
    "db_migration_check",
    "migration_list_local",
    "typecheck",
    "lint",
    "biome_check",
    "build",
  ],
  full: [
    "docs_check",
    "skills_check",
    "mcp_config_check",
    "mcp_typecheck",
    "mcp_test",
    "portfolio_mcp_typecheck",
    "portfolio_mcp_test",
    "api_typecheck",
    "api_test",
    "web_test",
    "db_migration_check",
    "migration_list_local",
    "typecheck",
    "lint",
    "biome_check",
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
  biome_check: [npmCommand, "run", "check:biome"],
  docs_check: [npmCommand, "run", "docs:check"],
  skills_check: [npmCommand, "run", "skills:check"],
  mcp_config_check: [npmCommand, "run", "mcp:check"],
  mcp_typecheck: [npmCommand, "run", "mcp:typecheck"],
  mcp_test: [npmCommand, "run", "test:mcp"],
  portfolio_mcp_typecheck: [npmCommand, "run", "mcp:portfolio:check"],
  portfolio_mcp_test: [npmCommand, "run", "test:portfolio-mcp"],
  api_typecheck: [
    npmCommand,
    "run",
    "typecheck",
    "--workspace=@syn-forge/portfolio-api",
    "--",
    "--pretty",
    "false",
  ],
  api_test: [npmCommand, "run", "test", "--workspace=@syn-forge/portfolio-api", "--"],
  web_test: [npmCommand, "run", "test", "--workspace=@syn-forge/portfolio-web", "--"],
  db_migration_check: [npmCommand, "run", "db:migration:check"],
  migration_list_local: [npmCommand, "run", "db:migrations:list:local"],
};

export const LOCAL_ONLY_MCP_TOOLS = new Set([
  "repository_workflow_status",
  "prepare_repository_change",
  "apply_repository_change",
  "verify_repository_change",
  "read_repository_change_diff",
  "read_working_tree_diff",
  "read_repository_files",
  "prepare_working_tree_commit",
  "git_commit_working_tree",
  "prepare_commits",
  "git_commit_files",
]);
