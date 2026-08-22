import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { setupGitHooks } from '../../scripts/setup-git-hooks.ts';
import { auditCommitRange, auditOneFileHistory, formatAuditFailure } from '../../scripts/audit-one-file-history.ts';
import { validateStagedPaths } from '../../scripts/validate-commit.ts';
import { requireGit, runGit } from '../mcp/support.ts';

const repositories: string[] = [];
const zeroSha = '0'.repeat(40);
const sourceRoot = resolve(process.cwd());

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => rm(repository, { recursive: true, force: true })));
});

async function createHistoryRepository(): Promise<string> {
  const repository = await mkdtemp(join(tmpdir(), 'operator-synaciel-history-'));
  repositories.push(repository);
  requireGit(repository, ['init', '--quiet']);
  requireGit(repository, ['config', 'user.email', 'test@example.invalid']);
  requireGit(repository, ['config', 'user.name', 'Hook Test']);
  await mkdir(join(repository, 'src'), { recursive: true });
  await writeFile(join(repository, 'src/one.ts'), 'one\n');
  requireGit(repository, ['add', '--all']);
  requireGit(repository, ['commit', '--quiet', '-m', 'Create the hook fixture.']);
  return repository;
}

describe('versioned Git commit policy', () => {
  test('requires exactly one staged path and restricted-path consent', () => {
    assert.equal(validateStagedPaths([]).ok, false);
    assert.equal(validateStagedPaths(['src/one.ts']).ok, true);
    assert.equal(validateStagedPaths(['src/one.ts', 'src/two.ts']).ok, false);
    assert.equal(validateStagedPaths(['.codex/fixture.md']).ok, false);
    assert.equal(validateStagedPaths(['.codex/fixture.md'], 'ephemeral-approval').ok, true);
  });

  test('configures the versioned hook path and audits outgoing history', async () => {
    const hookRepository = await createHistoryRepository();
    await mkdir(join(hookRepository, '.githooks'), { recursive: true });
    await writeFile(join(hookRepository, '.githooks/pre-commit'), '#!/usr/bin/env bash\nexit 0\n');
    await writeFile(join(hookRepository, '.githooks/pre-push'), '#!/usr/bin/env bash\nexit 0\n');
    await setupGitHooks(hookRepository);
    assert.equal(runGit(hookRepository, ['config', '--local', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');

    const repository = await createHistoryRepository();
    const base = requireGit(repository, ['rev-parse', 'HEAD']);
    requireGit(repository, ['update-ref', 'refs/remotes/origin/main', base]);
    await writeFile(join(repository, 'src/one.ts'), 'one updated\n');
    requireGit(repository, ['add', '--all']);
    requireGit(repository, ['commit', '--quiet', '-m', 'Update one source path.']);
    const result = auditOneFileHistory({
      cwd: repository,
      localSha: requireGit(repository, ['rev-parse', 'HEAD']),
      remoteSha: zeroSha,
      remoteRef: 'refs/heads/topic',
    });
    assert.equal(result.ok, true);
    assert.equal(result.commits.length, 1);

    requireGit(repository, ['config', 'core.hooksPath', resolve(sourceRoot, '.githooks')]);
    const pushHook = runGit(repository, ['rev-parse', 'HEAD']);
    const pushAudit = spawnSync(
      resolve(sourceRoot, '.githooks/pre-push'),
      [],
      {
        cwd: repository,
        input: `refs/heads/topic ${pushHook.stdout.trim()} refs/heads/topic ${zeroSha}\n`,
        encoding: 'utf8',
      },
    );
    assert.equal(pushAudit.status, 0);

    const invalidRepository = await createHistoryRepository();
    await writeFile(join(invalidRepository, 'src/two.ts'), 'two\n');
    await writeFile(join(invalidRepository, 'src/one.ts'), 'one multi-path change\n');
    requireGit(invalidRepository, ['add', '--all']);
    requireGit(invalidRepository, ['commit', '--quiet', '-m', 'Create two paths.']);
    const invalidBase = requireGit(invalidRepository, ['rev-parse', 'HEAD~1']);
    const audited = auditCommitRange({ cwd: invalidRepository, range: `${invalidBase}..HEAD` });
    assert.equal(audited.ok, false);
    assert.match(formatAuditFailure(audited), /2 changed paths/);
  });

  test('reports empty and merge commits in an outgoing history range', async () => {
    const repository = await createHistoryRepository();
    const base = requireGit(repository, ['rev-parse', 'HEAD']);
    requireGit(repository, ['commit', '--allow-empty', '--quiet', '-m', 'Create an empty commit.']);
    const emptyAudit = auditCommitRange({ cwd: repository, range: `${base}..HEAD` });
    assert.equal(emptyAudit.ok, false);
    assert.equal(emptyAudit.violations[0]?.reason, 'empty');

    requireGit(repository, ['branch', '-M', 'main']);
    requireGit(repository, ['switch', '-c', 'feature']);
    await writeFile(join(repository, 'src/feature.ts'), 'feature\n');
    requireGit(repository, ['add', '--all']);
    requireGit(repository, ['commit', '--quiet', '-m', 'Add the feature branch path.']);
    requireGit(repository, ['switch', 'main']);
    await writeFile(join(repository, 'src/main.ts'), 'main\n');
    requireGit(repository, ['add', '--all']);
    requireGit(repository, ['commit', '--quiet', '-m', 'Add the main branch path.']);
    requireGit(repository, ['merge', '--no-ff', '--quiet', 'feature', '-m', 'Merge the feature branch.']);
    const mergeAudit = auditCommitRange({ cwd: repository, range: `${base}..HEAD` });
    assert.equal(mergeAudit.ok, false);
    assert.ok(mergeAudit.violations.some((violation) => violation.reason === 'merge'));
  });
});
