import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';

import { withMutationLock } from './mutation-lock.ts';
import { COMMIT_APPROVAL_ENV, CONSENTABLE_RESTRICTED_DIRS } from './policy.ts';
import { isCredentialLikeContent } from './redaction.ts';
import {
  digestBytes,
  PROJECT_ROOT,
  safeAbsolutePath,
  validateLocalProjectRoot,
  validateRelativeProjectPath,
} from './path.ts';

const MAX_COMMIT_FILE_BYTES = 50 * 1024 * 1024;
const OPERATION_TTL_MS = 30 * 60 * 1_000;
const MAX_OPERATIONS = 100;

export type CommitEntry = {
  readonly path: string;
  readonly message: string;
};

type GitResult = {
  readonly command: string;
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

type GitStatusEntry = { readonly path: string; readonly status: string };

type FileSnapshot = {
  readonly path: string;
  readonly status: string;
  readonly hash: string | null;
  readonly size: number;
};

type WorkingTreeSnapshot = {
  readonly files: readonly FileSnapshot[];
  readonly diff: string;
  readonly hash: string;
};

type WorkingTreeOperation = {
  readonly id: string;
  readonly hash: string;
  readonly createdAt: string;
  readonly expiresAt: number;
  readonly snapshot: WorkingTreeSnapshot;
  readonly commitApprovalMarker?: string;
};

type RestrictedPathReview = {
  readonly path: string;
  readonly status: string;
  readonly size: number;
};

type WorkingTreeConsentChallenge = {
  readonly tokenHash: string;
  readonly paths: readonly string[];
  readonly snapshotHash: string;
  readonly expiresAt: number;
};

type AppliedFile = {
  readonly path: string;
  readonly action: 'create' | 'update';
  readonly hash: string;
};

type AppliedOperation = {
  readonly id: string;
  readonly hash: string;
  readonly createdAt: string;
  readonly expiresAt: number;
  readonly files: readonly AppliedFile[];
  readonly commitApprovalMarker?: string;
};

export type AppliedRepositoryOperationInput = { readonly files: readonly AppliedFile[] };

export type CommitPipelineResult = {
  readonly status: 'consent_required' | 'prepared' | 'committed' | 'partial';
  readonly operationId?: string;
  readonly approvalHash?: string;
  readonly kind: 'working-tree-commit' | 'applied-change-commit';
  readonly createdAt?: string;
  readonly paths?: readonly string[];
  readonly restrictedPaths?: readonly RestrictedPathReview[];
  readonly consentToken?: string;
  readonly message?: string;
  readonly snapshot?: WorkingTreeSnapshot;
  readonly commits?: readonly Record<string, unknown>[];
  readonly filesPerCommit?: readonly number[];
  readonly allOneFile?: boolean;
  readonly beforeStatus?: GitResult;
  readonly afterStatus?: GitResult;
};

const workingTreeOperations = new Map<string, WorkingTreeOperation>();
const appliedOperations = new Map<string, AppliedOperation>();
const consentChallenges = new Map<string, WorkingTreeConsentChallenge>();

function digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function fail(message: string): never {
  throw new Error(message);
}

function runGit(args: readonly string[]): GitResult {
  const result = spawnSync('git', [...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
    shell: false,
    env: { ...process.env, GIT_PAGER: 'cat' },
  });
  return {
    command: ['git', ...args].join(' '),
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ''),
  };
}

function requireGit(args: readonly string[]): GitResult {
  const result = runGit(args);
  if (result.status !== 0) fail(result.stderr || `${result.command} failed.`);
  return result;
}

function hasRestrictedPath(path: string): boolean {
  return path.split('/').some((part) => CONSENTABLE_RESTRICTED_DIRS.has(part));
}

function normalizePath(input: string, allowRestrictedPaths = false): string {
  return validateRelativeProjectPath(input, { allowRestrictedPaths });
}

function parseStatus(output: string, allowRestrictedPaths = false): GitStatusEntry[] {
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => ({
      status: record.slice(0, 2),
      path: normalizePath(record.slice(3), allowRestrictedPaths),
    }));
}

function currentStatus(allowRestrictedPaths = false): GitStatusEntry[] {
  return parseStatus(
    requireGit(['status', '--porcelain=v1', '--untracked-files=all', '--no-renames', '-z']).stdout,
    allowRestrictedPaths,
  );
}

function statusResult(): GitResult {
  return runGit(['status', '--short', '--untracked-files=all', '--no-renames']);
}

async function fileSnapshot(path: string, allowRestrictedPaths = false): Promise<{
  readonly hash: string | null;
  readonly size: number;
}> {
  const { absolutePath } = await safeAbsolutePath(path, { allowRestrictedPaths });
  const info = await lstat(absolutePath).catch(() => null);
  if (!info) return { hash: null, size: 0 };
  if (!info.isFile()) fail(`The reviewed path is not a regular file: ${path}`);
  if (info.size > MAX_COMMIT_FILE_BYTES) fail(`The reviewed file is too large: ${path}`);
  const bytes = await readFile(absolutePath);
  if (!bytes.includes(0) && isCredentialLikeContent(bytes.toString('utf8'))) {
    fail(`Credential-like content cannot be reviewed through the commit pipeline: ${path}`);
  }
  return { hash: digestBytes(bytes), size: bytes.byteLength };
}

async function buildDiff(entries: readonly GitStatusEntry[], allowRestrictedPaths: boolean): Promise<string> {
  if (entries.length === 0) return '';
  const tracked = entries.filter((entry) => entry.status !== '??').map((entry) => entry.path);
  const parts: string[] = [];
  if (tracked.length > 0) {
    parts.push(requireGit(['diff', '--binary', '--no-ext-diff', '--no-renames', '--', ...tracked]).stdout);
  }

  for (const entry of entries.filter((candidate) => candidate.status === '??')) {
    const { absolutePath } = await safeAbsolutePath(entry.path, { allowRestrictedPaths });
    const snapshot = await fileSnapshot(entry.path, allowRestrictedPaths);
    if (snapshot.size > 1_000_000) {
      parts.push(`diff --git a/${entry.path} b/${entry.path}\nBinary files differ: ${entry.path}\n`);
      continue;
    }
    const content = await readFile(absolutePath, 'utf8');
    if (content.includes('\0')) {
      parts.push(`diff --git a/${entry.path} b/${entry.path}\nBinary files differ: ${entry.path}\n`);
      continue;
    }
    parts.push(
      [`--- /dev/null`, `+++ b/${entry.path}`, `@@ -0,0 +1,${content.split(/\r?\n/).length} @@`, ...content.split(/\r?\n/).map((line) => `+${line}`)].join('\n'),
    );
  }
  return parts.join('\n').slice(0, 2_000_000);
}

async function captureWorkingTreeSnapshot(allowRestrictedPaths = false): Promise<WorkingTreeSnapshot> {
  const entries = currentStatus(allowRestrictedPaths);
  const files = await Promise.all(
    entries.map(async (entry) => ({
      path: entry.path,
      status: entry.status,
      ...(await fileSnapshot(entry.path, allowRestrictedPaths)),
    })),
  );
  const diff = await buildDiff(entries, allowRestrictedPaths);
  const hash = digest(JSON.stringify(files));
  return { files, diff, hash };
}

function pruneOperations(): void {
  const now = Date.now();
  for (const [id, operation] of workingTreeOperations) if (operation.expiresAt <= now) workingTreeOperations.delete(id);
  for (const [id, operation] of appliedOperations) if (operation.expiresAt <= now) appliedOperations.delete(id);
  for (const [id, challenge] of consentChallenges) if (challenge.expiresAt <= now) consentChallenges.delete(id);
  while (workingTreeOperations.size + appliedOperations.size > MAX_OPERATIONS) {
    const firstWorking = workingTreeOperations.keys().next().value;
    if (firstWorking) workingTreeOperations.delete(firstWorking);
    else {
      const firstApplied = appliedOperations.keys().next().value;
      if (!firstApplied) break;
      appliedOperations.delete(firstApplied);
    }
  }
}

function tokenHash(token: string): string {
  return digest(token);
}

function restrictedPathReviews(files: readonly FileSnapshot[]): RestrictedPathReview[] {
  return files
    .filter((file) => hasRestrictedPath(file.path))
    .map(({ path, status, size }) => ({ path, status, size }));
}

function getWorkingTreeOperation(operationId: string, approvalHash: string): WorkingTreeOperation {
  pruneOperations();
  const operation = workingTreeOperations.get(operationId);
  if (!operation || operation.hash !== approvalHash) fail('The working-tree operation ID or approval hash is invalid or stale.');
  return operation;
}

function getAppliedOperation(operationId: string, approvalHash: string): AppliedOperation {
  pruneOperations();
  const operation = appliedOperations.get(operationId);
  if (!operation || operation.hash !== approvalHash) fail('The applied-change operation ID or approval hash is invalid or stale.');
  return operation;
}

function validateCommitMessage(message: string, path: string): void {
  const lines = message.trim().split(/\r?\n/);
  const subject = lines.shift()?.trim() ?? '';
  if (!subject || subject.length > 200 || !subject.endsWith('.') || /[\r\n]/.test(subject)) {
    fail('Commit messages require a one-sentence subject ending with a period.');
  }
  const pathName = path.split('/').pop() ?? path;
  for (const verb of ['Add', 'Create', 'Delete', 'Update']) {
    if (subject === `${verb} ${path}.` || subject === `${verb} ${pathName}.`) {
      fail(`The commit subject must describe the change, not only the path: ${path}`);
    }
  }
  for (const line of lines) {
    if (!/^Co-authored-by: [^<>\n]+ <[^<>\s]+@[^<>\s]+>$/.test(line.trim())) {
      fail('Only valid Co-authored-by trailers may follow the commit subject.');
    }
  }
}

function validateCommitEntries(
  entries: readonly CommitEntry[],
  expected: ReadonlySet<string>,
  allowRestrictedPaths = false,
): string[] {
  if (entries.length !== expected.size) {
    fail(`Provide exactly one commit per reviewed file (${expected.size} expected, ${entries.length} given).`);
  }
  const requested = entries.map((entry) => normalizePath(entry.path, allowRestrictedPaths));
  if (new Set(requested).size !== requested.length) fail('Duplicate commit paths are not allowed.');
  for (let index = 0; index < entries.length; index += 1) {
    const path = requested[index];
    if (!expected.has(path)) fail(`Unrelated working-tree changes must be resolved before committing: ${path}`);
    validateCommitMessage(entries[index].message, path);
  }
  return requested;
}

async function ensureFileHash(path: string, expectedHash: string | null, allowRestrictedPaths = false): Promise<void> {
  const current = await fileSnapshot(path, allowRestrictedPaths);
  if (current.hash !== expectedHash) fail(`The reviewed file changed after preparation: ${path}`);
}

function unstagePaths(paths: readonly string[]): void {
  if (paths.length === 0) return;
  const result = runGit(['reset', '--quiet', 'HEAD', '--', ...paths]);
  if (result.status !== 0 && runGit(['reset', '--quiet', '--', ...paths]).status !== 0) {
    fail(result.stderr || 'Could not clear the staged paths.');
  }
}

function stagePath(path: string): void {
  requireGit(['add', '--all', '--', path]);
}

function stagedPaths(): readonly string[] {
  return requireGit(['diff', '--cached', '--name-only', '--no-renames', '-z']).stdout.split('\0').filter(Boolean);
}

function commitPath(path: string, message: string, commitApprovalMarker?: string): GitResult {
  return spawnCommit(['commit', '-m', message, '--', path], commitApprovalMarker);
}

function spawnCommit(args: readonly string[], commitApprovalMarker?: string): GitResult {
  const result = spawnSync('git', [...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
    shell: false,
    env: {
      ...process.env,
      GIT_PAGER: 'cat',
      ...(commitApprovalMarker ? { [COMMIT_APPROVAL_ENV]: commitApprovalMarker } : {}),
    },
  });
  return {
    command: ['git', ...args].join(' '),
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ''),
  };
}

function committedFileCount(): number {
  return requireGit(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD']).stdout
    .split('\0')
    .filter(Boolean).length;
}

async function ensureWorkingTreeProgress(
  operation: WorkingTreeOperation,
  committed: ReadonlySet<string>,
): Promise<Map<string, GitStatusEntry>> {
  const allowRestrictedPaths = operation.snapshot.files.some((file) => hasRestrictedPath(file.path));
  const entries = currentStatus(allowRestrictedPaths);
  const expected = new Set(operation.snapshot.files.map((file) => file.path));
  for (const entry of entries) if (!expected.has(entry.path)) fail(`Unrelated working-tree changes must be resolved before committing: ${entry.path}`);
  for (const file of operation.snapshot.files) {
    const status = entries.find((entry) => entry.path === file.path);
    await ensureFileHash(file.path, file.hash, allowRestrictedPaths);
    if (committed.has(file.path)) {
      if (status) fail(`A previously committed file changed during the commit loop: ${file.path}`);
    } else if (!status) {
      fail(`The reviewed file is no longer dirty: ${file.path}`);
    }
  }
  return new Map(entries.map((entry) => [entry.path, entry]));
}

export async function prepareWorkingTreeCommit(input: {
  readonly consentToken?: string;
  readonly approveRestrictedPaths?: boolean;
} = {}): Promise<CommitPipelineResult> {
  pruneOperations();
  const root = await validateLocalProjectRoot();
  if (!root.valid) fail(root.reason);
  if (input.approveRestrictedPaths && !input.consentToken) fail('Restricted-path approval requires the consent token returned by preparation.');

  const initialSnapshot = await captureWorkingTreeSnapshot(true);
  const restrictedPaths = restrictedPathReviews(initialSnapshot.files);
  if (restrictedPaths.length > 0 && !input.consentToken) {
    const consentToken = randomUUID();
    consentChallenges.set(tokenHash(consentToken), {
      tokenHash: tokenHash(consentToken),
      paths: restrictedPaths.map((file) => file.path),
      snapshotHash: initialSnapshot.hash,
      expiresAt: Date.now() + OPERATION_TTL_MS,
    });
    return {
      status: 'consent_required',
      kind: 'working-tree-commit',
      paths: initialSnapshot.files.map((file) => file.path),
      restrictedPaths,
      consentToken,
      message: 'Explicit user consent is required for these restricted paths. Review the paths, then retry with the token and approval flag.',
    };
  }

  let commitApprovalMarker: string | undefined;
  if (restrictedPaths.length > 0) {
    if (!input.approveRestrictedPaths) fail('Explicit restricted-path approval is required when using a consent token.');
    const challenge = consentChallenges.get(tokenHash(input.consentToken ?? ''));
    if (!challenge || challenge.expiresAt <= Date.now()) fail('The restricted-path consent token is invalid, stale, or expired.');
    const currentPaths = restrictedPaths.map((file) => file.path);
    if (challenge.snapshotHash !== initialSnapshot.hash || JSON.stringify(challenge.paths) !== JSON.stringify(currentPaths)) {
      consentChallenges.delete(challenge.tokenHash);
      fail('The restricted working-tree paths changed after consent was requested; prepare a new review operation.');
    }
    consentChallenges.delete(challenge.tokenHash);
    commitApprovalMarker = randomUUID();
  }

  const snapshot = await captureWorkingTreeSnapshot(true);
  const operationId = randomUUID();
  const operation: WorkingTreeOperation = {
    id: operationId,
    hash: digest(JSON.stringify({ kind: 'working-tree-commit', snapshot })),
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + OPERATION_TTL_MS,
    snapshot,
    ...(commitApprovalMarker ? { commitApprovalMarker } : {}),
  };
  workingTreeOperations.set(operationId, operation);
  return {
    status: 'prepared',
    operationId,
    approvalHash: operation.hash,
    kind: 'working-tree-commit',
    createdAt: operation.createdAt,
    paths: snapshot.files.map((file) => file.path),
    restrictedPaths,
    snapshot,
    message: 'Working tree prepared. Review every path, hash, and diff before committing.',
  };
}

export async function commitWorkingTree(
  operationId: string,
  approvalHash: string,
  commits: readonly CommitEntry[],
): Promise<CommitPipelineResult> {
  const operation = getWorkingTreeOperation(operationId, approvalHash);
  const expected = new Set(operation.snapshot.files.map((file) => file.path));
  const allowRestrictedPaths = operation.snapshot.files.some((file) => hasRestrictedPath(file.path));
  const paths = validateCommitEntries(commits, expected, allowRestrictedPaths);

  return withMutationLock(async () => {
    const beforeStatus = statusResult();
    const committed = new Set<string>();
    const results: Record<string, unknown>[] = [];
    const filesPerCommit: number[] = [];
    for (const path of paths) {
      const current = await ensureWorkingTreeProgress(operation, committed);
      if (!current.has(path)) fail(`The reviewed file is no longer dirty: ${path}`);
      const file = operation.snapshot.files.find((candidate) => candidate.path === path);
      if (!file) fail(`The path was not part of the prepared working tree: ${path}`);

      unstagePaths([...expected].filter((candidate) => !committed.has(candidate)));
      await ensureFileHash(path, file.hash, allowRestrictedPaths);
      stagePath(path);
      const staged = stagedPaths();
      if (staged.length !== 1 || staged[0] !== path) fail(`The commit stage must contain exactly one reviewed path: ${path}`);
      const result = commitPath(path, commits[paths.indexOf(path)].message, hasRestrictedPath(path) ? operation.commitApprovalMarker : undefined);
      results.push({ path, ...result });
      if (result.status !== 0) {
        return {
          status: 'partial',
          operationId,
          approvalHash,
          kind: 'working-tree-commit',
          paths,
          commits: results,
          filesPerCommit,
          allOneFile: filesPerCommit.every((count) => count === 1),
          beforeStatus,
          afterStatus: statusResult(),
          message: 'The commit loop stopped after a Git or hook failure; report the partial progress and prepare again.',
        };
      }
      filesPerCommit.push(committedFileCount());
      committed.add(path);
    }
    const afterStatus = statusResult();
    if (afterStatus.status !== 0) fail(afterStatus.stderr || 'Could not inspect the committed working tree.');
    workingTreeOperations.delete(operationId);
    return {
      status: 'committed',
      operationId,
      approvalHash,
      kind: 'working-tree-commit',
      paths,
      commits: results,
      filesPerCommit,
      allOneFile: filesPerCommit.every((count) => count === 1),
      beforeStatus,
      afterStatus,
      message: 'All reviewed paths were committed one at a time.',
    };
  });
}

export function registerAppliedRepositoryOperation(input: AppliedRepositoryOperationInput): {
  readonly operationId: string;
  readonly approvalHash: string;
} {
  pruneOperations();
  const operationId = randomUUID();
  const commitApprovalMarker = input.files.some((file) => hasRestrictedPath(file.path)) ? randomUUID() : undefined;
  const createdAt = new Date().toISOString();
  const hash = digest(JSON.stringify({ kind: 'applied-change-commit', files: input.files }));
  appliedOperations.set(operationId, {
    id: operationId,
    hash,
    createdAt,
    expiresAt: Date.now() + OPERATION_TTL_MS,
    files: input.files,
    ...(commitApprovalMarker ? { commitApprovalMarker } : {}),
  });
  return { operationId, approvalHash: hash };
}

export async function prepareCommits(operationId: string, approvalHash: string): Promise<CommitPipelineResult & { readonly commits: readonly CommitEntry[] }> {
  const operation = getAppliedOperation(operationId, approvalHash);
  for (const file of operation.files) await ensureFileHash(file.path, file.hash, hasRestrictedPath(file.path));
  return {
    status: 'prepared',
    operationId,
    approvalHash,
    kind: 'applied-change-commit',
    createdAt: operation.createdAt,
    paths: operation.files.map((file) => file.path),
    commits: operation.files.map((file) => ({
      path: file.path,
      message: file.action === 'create' ? `Add the reviewed file ${file.path}.` : `Update the reviewed file ${file.path}.`,
    })),
    message: 'Review and edit each suggested subject before committing.',
  };
}

export async function commitAppliedFiles(
  operationId: string,
  approvalHash: string,
  commits: readonly CommitEntry[],
): Promise<CommitPipelineResult> {
  const operation = getAppliedOperation(operationId, approvalHash);
  const expected = new Set(operation.files.map((file) => file.path));
  const allowRestrictedPaths = operation.files.some((file) => hasRestrictedPath(file.path));
  const paths = validateCommitEntries(commits, expected, allowRestrictedPaths);

  return withMutationLock(async () => {
    const beforeStatus = statusResult();
    const initialEntries = currentStatus(allowRestrictedPaths);
    if (new Set(initialEntries.map((entry) => entry.path)).size !== expected.size || initialEntries.some((entry) => !expected.has(entry.path))) {
      fail('The applied operation must be the complete dirty working-tree scope before committing.');
    }
    const results: Record<string, unknown>[] = [];
    const filesPerCommit: number[] = [];
    const remaining = new Set(paths);
    for (const path of paths) {
      const file = operation.files.find((candidate) => candidate.path === path);
      if (!file) fail(`The path was not part of the applied operation: ${path}`);
      await ensureFileHash(path, file.hash, allowRestrictedPaths);
      const currentEntries = currentStatus(allowRestrictedPaths);
      if (currentEntries.some((entry) => !remaining.has(entry.path))) fail(`A previously committed or unrelated path changed during the commit loop: ${path}`);
      if (!currentEntries.some((entry) => entry.path === path)) fail(`The applied file is no longer dirty: ${path}`);
      unstagePaths([...remaining]);
      stagePath(path);
      const staged = stagedPaths();
      if (staged.length !== 1 || staged[0] !== path) fail(`The commit stage must contain exactly one reviewed path: ${path}`);
      const result = commitPath(path, commits[paths.indexOf(path)].message, hasRestrictedPath(path) ? operation.commitApprovalMarker : undefined);
      results.push({ path, ...result });
      if (result.status !== 0) {
        return {
          status: 'partial',
          operationId,
          approvalHash,
          kind: 'applied-change-commit',
          paths,
          commits: results,
          filesPerCommit,
          allOneFile: filesPerCommit.every((count) => count === 1),
          beforeStatus,
          afterStatus: statusResult(),
          message: 'The commit loop stopped after a Git or hook failure; report the partial progress and prepare again.',
        };
      }
      filesPerCommit.push(committedFileCount());
      remaining.delete(path);
    }
    const afterStatus = statusResult();
    if (afterStatus.status !== 0) fail(afterStatus.stderr || 'Could not inspect the committed working tree.');
    appliedOperations.delete(operationId);
    return {
      status: 'committed',
      operationId,
      approvalHash,
      kind: 'applied-change-commit',
      paths,
      commits: results,
      filesPerCommit,
      allOneFile: filesPerCommit.every((count) => count === 1),
      beforeStatus,
      afterStatus,
      message: 'All applied paths were committed one at a time.',
    };
  });
}
