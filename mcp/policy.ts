export const MCP_SERVER_NAME = 'operator-synaciel-repository';
export const MCP_SERVER_VERSION = '1.0.0';
export const COMMIT_APPROVAL_ENV = 'OPERATOR_SYNACIEL_COMMIT_PIPELINE_APPROVAL';

export const IGNORED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  'build',
  'coverage',
  'target',
  '.wrangler',
  'graphify-out',
]);

export const CONSENTABLE_RESTRICTED_DIRS: ReadonlySet<string> = new Set([
  '.agents',
  '.codex',
  '.obsidian',
]);

export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  '.7z',
  '.eot',
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.svg',
  '.tar',
  '.ttf',
  '.wasm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

export const REPOSITORY_WRITE_PROFILES = {
  app: {
    prefixes: ['src/', 'public/', 'index.html', 'vite/', 'vite.config.ts'],
    maxFiles: 60,
    maxBytes: 500_000,
  },
  docs: {
    prefixes: ['docs/', 'README.md', 'AGENTS.md'],
    maxFiles: 50,
    maxBytes: 400_000,
  },
  mcp: {
    prefixes: [
      'mcp/',
      'tests/mcp/',
      'tests/scripts/',
      'scripts/',
      '.githooks/',
      '.codex/',
      '.agents/',
      '.obsidian/',
      'docs/',
      'package.json',
      'package-lock.json',
      'tsconfig.mcp.json',
      'eslint.config.js',
    ],
    maxFiles: 80,
    maxBytes: 500_000,
  },
  database: {
    prefixes: ['migrations/', 'wrangler.toml'],
    maxFiles: 30,
    maxBytes: 300_000,
  },
  config: {
    prefixes: [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.node.json',
      'tsconfig.mcp.json',
      'eslint.config.js',
      'wrangler.toml',
      '.gitignore',
      '.graphifyignore',
      'Pipfile',
      'Pipfile.lock',
    ],
    maxFiles: 25,
    maxBytes: 300_000,
  },
} as const;

export type RepositoryWriteProfile = keyof typeof REPOSITORY_WRITE_PROFILES;

export const REPOSITORY_VERIFICATION_PROFILES = {
  app: ['typecheck', 'lint', 'build'],
  docs: ['docs_check'],
  mcp: ['mcp_typecheck', 'mcp_test', 'lint'],
  database: ['docs_check', 'migration_list_local'],
  config: ['typecheck', 'lint'],
  full: ['docs_check', 'mcp_typecheck', 'mcp_test', 'typecheck', 'lint', 'build'],
} as const;

export type RepositoryVerificationProfile = keyof typeof REPOSITORY_VERIFICATION_PROFILES;
export type SafeVerificationCheck =
  (typeof REPOSITORY_VERIFICATION_PROFILES)[keyof typeof REPOSITORY_VERIFICATION_PROFILES][number];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export const SAFE_VERIFICATION_COMMANDS: Record<SafeVerificationCheck, readonly string[]> = {
  typecheck: [npmCommand, 'run', 'typecheck'],
  lint: [npmCommand, 'run', 'lint'],
  build: [npmCommand, 'run', 'build'],
  docs_check: [npmCommand, 'run', 'docs:check'],
  mcp_typecheck: [npmCommand, 'run', 'mcp:typecheck'],
  mcp_test: [npmCommand, 'run', 'test:mcp'],
  migration_list_local: [npmCommand, 'run', 'db:migrations:list:local'],
};

export const LOCAL_ONLY_MCP_TOOLS = new Set([
  'prepare_repository_change',
  'apply_repository_change',
  'verify_repository_change',
  'prepare_working_tree_commit',
  'git_commit_working_tree',
  'prepare_commits',
  'git_commit_files',
]);
