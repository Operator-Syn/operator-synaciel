import { spawnSync } from 'node:child_process';

const ZERO_SHA = /^0{40}$/;

type GitResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type HistoryViolation = {
  readonly hash: string;
  readonly subject: string;
  readonly paths: readonly string[];
  readonly reason: 'merge' | 'empty' | 'multiple-paths';
};

export type HistoryAuditResult = {
  readonly ok: boolean;
  readonly range: string | null;
  readonly commits: readonly string[];
  readonly violations: readonly HistoryViolation[];
};

export type HistoryAuditOptions = {
  readonly cwd?: string;
  readonly range?: string;
  readonly localSha?: string;
  readonly remoteSha?: string;
  readonly remoteRef?: string;
};

function runGit(cwd: string, args: readonly string[]): GitResult {
  const result = spawnSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ''),
  };
}

function requireGit(cwd: string, args: readonly string[]): GitResult {
  const result = runGit(cwd, args);
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed.`);
  return result;
}

function isZeroSha(value: string | undefined): boolean {
  return value !== undefined && ZERO_SHA.test(value);
}

function resolveNewPushBase(cwd: string, remoteRef?: string): string | null {
  const candidateRefs = new Set(['origin/main']);
  if (remoteRef?.startsWith('refs/heads/')) candidateRefs.add(`origin/${remoteRef.slice('refs/heads/'.length)}`);
  for (const candidateRef of candidateRefs) {
    const base = runGit(cwd, ['rev-parse', '--verify', `${candidateRef}^{commit}`]);
    if (base.status === 0 && base.stdout.trim()) return base.stdout.trim();
  }
  return null;
}

export function resolveAuditRange(options: HistoryAuditOptions): string | null {
  if (options.range) return options.range;
  if (!options.localSha) throw new Error('Provide --range or a local push SHA to audit.');
  if (isZeroSha(options.localSha)) return null;
  if (options.remoteSha && !isZeroSha(options.remoteSha)) return `${options.remoteSha}..${options.localSha}`;
  const base = resolveNewPushBase(options.cwd ?? process.cwd(), options.remoteRef);
  return base ? `${base}..${options.localSha}` : options.localSha;
}

function commitParents(cwd: string, hash: string): readonly string[] {
  return requireGit(cwd, ['rev-list', '--parents', '-n', '1', hash]).stdout.trim().split(/\s+/).filter(Boolean).slice(1);
}

function commitPaths(cwd: string, hash: string): readonly string[] {
  return requireGit(cwd, ['diff-tree', '--root', '--no-commit-id', '--name-only', '--no-renames', '-r', '-z', hash]).stdout.split('\0').filter(Boolean);
}

function commitSubject(cwd: string, hash: string): string {
  return requireGit(cwd, ['show', '-s', '--format=%s', hash]).stdout.trim();
}

export function auditCommitRange(options: { readonly cwd?: string; readonly range: string }): HistoryAuditResult {
  const cwd = options.cwd ?? process.cwd();
  const commits = requireGit(cwd, ['rev-list', '--reverse', options.range]).stdout.trim().split(/\s+/).filter(Boolean);
  const violations: HistoryViolation[] = [];
  for (const hash of commits) {
    const subject = commitSubject(cwd, hash);
    const parents = commitParents(cwd, hash);
    if (parents.length > 1) {
      violations.push({ hash, subject, paths: [], reason: 'merge' });
      continue;
    }
    const paths = commitPaths(cwd, hash);
    if (paths.length === 0) violations.push({ hash, subject, paths, reason: 'empty' });
    else if (paths.length !== 1) violations.push({ hash, subject, paths, reason: 'multiple-paths' });
  }
  return { ok: violations.length === 0, range: options.range, commits, violations };
}

export function auditOneFileHistory(options: HistoryAuditOptions): HistoryAuditResult {
  const range = resolveAuditRange(options);
  if (!range) return { ok: true, range: null, commits: [], violations: [] };
  return auditCommitRange({ cwd: options.cwd, range });
}

export function formatAuditFailure(result: HistoryAuditResult): string {
  const lines = ['One-file commit audit failed.', ...(result.range ? [`Audited range: ${result.range}`] : [])];
  for (const violation of result.violations) {
    const detail = violation.reason === 'merge'
      ? 'merge commit'
      : violation.reason === 'empty'
        ? 'no changed paths'
        : `${violation.paths.length} changed paths: ${violation.paths.join(', ')}`;
    lines.push(`${violation.hash} ${violation.subject} (${detail})`);
  }
  return lines.join('\n');
}

function parseArgs(args: readonly string[]): HistoryAuditOptions {
  const options: { cwd?: string; range?: string; localSha?: string; remoteSha?: string; remoteRef?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if ((arg === '--range' || arg === '--local-sha' || arg === '--remote-sha' || arg === '--remote-ref') && value) {
      if (arg === '--range') options.range = value;
      if (arg === '--local-sha') options.localSha = value;
      if (arg === '--remote-sha') options.remoteSha = value;
      if (arg === '--remote-ref') options.remoteRef = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete audit argument: ${arg}`);
  }
  return options;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const result = auditOneFileHistory(parseArgs(process.argv.slice(2)));
    if (!result.ok) {
      console.error(formatAuditFailure(result));
      process.exitCode = 1;
    } else {
      console.log(`One-file commit audit passed${result.range ? ` for ${result.range}` : '.'}`);
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
