import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, stat, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BINARY_EXTENSIONS,
  CONSENTABLE_RESTRICTED_DIRS,
  IGNORED_DIRS,
} from './policy.ts';
import { isSensitiveFileName } from './redaction.ts';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function discoverRoot(): string {
  const configured = process.env.OPERATOR_SYNACIEL_MCP_ROOT;
  if (configured) return resolve(configured);

  const result = spawnSync('git', ['-C', serverRoot, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (result.status === 0 && result.stdout.trim()) return resolve(result.stdout.trim());
  return serverRoot;
}

export const PROJECT_ROOT = discoverRoot();
export const MAX_FILE_BYTES = 512_000;

function hasRestrictedPart(path: string): boolean {
  return path.split('/').some((part) => CONSENTABLE_RESTRICTED_DIRS.has(part));
}

function normalizeInput(input: string): string {
  const normalized = input.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new Error('Absolute, empty, and NUL-containing paths are not allowed.');
  }
  if (normalized.startsWith(':') || normalized.split('/').includes('..')) {
    throw new Error('Path traversal and Git pathspec magic are not allowed.');
  }
  return normalized;
}

export function validateRelativeProjectPath(
  input: string,
  options: { readonly allowRestrictedPaths?: boolean } = {},
): string {
  const normalized = normalizeInput(input);
  const absolute = resolve(PROJECT_ROOT, normalized);
  const relativePath = relative(PROJECT_ROOT, absolute).replaceAll('\\', '/');
  if (!relativePath || relativePath.startsWith('..') || resolve(PROJECT_ROOT, relativePath) !== absolute) {
    throw new Error('Path escapes the project root.');
  }
  for (const part of relativePath.split('/')) {
    if (IGNORED_DIRS.has(part)) throw new Error('Path is inside an ignored runtime directory.');
    if (CONSENTABLE_RESTRICTED_DIRS.has(part) && !options.allowRestrictedPaths) {
      throw new Error('Path requires explicit restricted-path consent.');
    }
  }
  return relativePath;
}

export function isLikelyBinaryPath(path: string): boolean {
  return BINARY_EXTENSIONS.has(extname(path).toLowerCase());
}

export async function validateLocalProjectRoot(): Promise<
  | { readonly valid: true; readonly root: string }
  | { readonly valid: false; readonly reason: string }
> {
  const info = await lstat(PROJECT_ROOT).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()) {
    return { valid: false, reason: 'The configured MCP repository root must be a real directory.' };
  }

  const canonical = await realpath(PROJECT_ROOT).catch(() => null);
  if (!canonical || canonical !== PROJECT_ROOT) {
    return { valid: false, reason: 'The configured MCP repository root must be canonical.' };
  }

  const packageInfo = await lstat(resolve(PROJECT_ROOT, 'package.json')).catch(() => null);
  if (!packageInfo?.isFile()) {
    return { valid: false, reason: 'The configured MCP repository root lacks package.json.' };
  }

  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 5_000,
  });
  if (git.status !== 0 || resolve(git.stdout.trim()) !== PROJECT_ROOT) {
    return { valid: false, reason: 'The configured MCP repository root must be the canonical Git root.' };
  }
  return { valid: true, root: PROJECT_ROOT };
}

export async function safeAbsolutePath(
  input: string,
  options: { readonly allowRestrictedPaths?: boolean } = {},
): Promise<{ readonly relativePath: string; readonly absolutePath: string }> {
  const relativePath = validateRelativeProjectPath(input, {
    allowRestrictedPaths: options.allowRestrictedPaths ?? hasRestrictedPart(input.replaceAll('\\', '/')),
  });
  let current = PROJECT_ROOT;
  for (const part of relativePath.split('/')) {
    current = resolve(current, part);
    const info = await lstat(current).catch(() => null);
    if (info?.isSymbolicLink()) throw new Error(`Symbolic-link paths are denied: ${relativePath}`);
  }

  const basename = relativePath.split('/').pop() ?? '';
  if (isSensitiveFileName(basename)) throw new Error('Sensitive environment and credential files are denied.');
  return { relativePath, absolutePath: resolve(PROJECT_ROOT, relativePath) };
}

export async function pathExists(relativePath: string): Promise<boolean> {
  const { absolutePath } = await safeAbsolutePath(relativePath);
  return (await stat(absolutePath).catch(() => null)) !== null;
}

export async function readTextFile(relativePath: string): Promise<string | null> {
  const { absolutePath } = await safeAbsolutePath(relativePath);
  const info = await stat(absolutePath).catch(() => null);
  if (!info?.isFile() || info.size > MAX_FILE_BYTES) return null;
  const content = await readFile(absolutePath, 'utf8');
  return content.includes('\0') ? null : content;
}

export function digestBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function atomicWrite(relativePath: string, content: string, token: string): Promise<void> {
  const { absolutePath } = await safeAbsolutePath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.${token}.tmp`;
  try {
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, absolutePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
