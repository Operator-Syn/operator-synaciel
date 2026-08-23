export const MCP_SERVER_NAME = "operator-synaciel-repository";
export const MCP_SERVER_VERSION = "1.1.0";
export const COMMIT_APPROVAL_ENV = "OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL";
export const MCP_SERVER_INSTRUCTIONS =
  "Use repository_workflow_status before mutation. For changes, prepare, review exact paths and hashes, apply only with explicit approval, run fixed verification, then commit through the guarded one-file pipeline. Never deploy, access Cloudflare credentials, apply D1 migrations, or perform remote Git operations through this server. Use Graphify separately for code relationships.";

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
    prefixes: [".well-known/", "src/", "public/", "index.html", "vite/", "vite.config.ts"],
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
      "mcp/",
      "tests/",
      "scripts/",
      ".githooks/",
      ".codex/",
      ".agents/",
      ".impeccable/",
      ".obsidian/",
      "docs/",
      "package.json",
      "package-lock.json",
      ".mcp.json",
      "tsconfig.mcp.json",
      "eslint.config.js",
    ],
    maxFiles: 80,
    maxBytes: 500_000,
  },
  database: {
    prefixes: [
      "migrations/",
      "src/db/",
      "src/data/Initial-Seed.sql",
      "drizzle.config.ts",
      "wrangler.toml",
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
      "tsconfig.app.json",
      "tsconfig.node.json",
      "tsconfig.mcp.json",
      "eslint.config.js",
      "biome.json",
      "drizzle.config.ts",
      "index.html",
      "vite.config.ts",
      "wrangler.toml",
      ".gitignore",
      ".vscode/",
      ".well-known/",
      "docs/",
      "mcp/",
      "public/",
      "scripts/",
      "src/",
      "tests/",
      ".graphifyignore",
      "Pipfile",
      "Pipfile.lock",
    ],
    maxFiles: 25,
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
  "prepare_working_tree_commit",
  "git_commit_working_tree",
  "prepare_commits",
  "git_commit_files",
]);
