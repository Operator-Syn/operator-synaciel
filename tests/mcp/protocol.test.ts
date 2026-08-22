import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { afterEach, describe, test } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createRepository,
  payload,
  removeRepository,
  repositoryRoot,
  serverEntry,
  startServer,
  tsx,
} from './support.ts';

const repositories: string[] = [];
const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(repositories.splice(0).map(removeRepository));
});

describe('repository MCP protocol', () => {
  test('initializes and exposes the guarded repository tools', async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const response = await server.call('tools/list');
    const names = new Set((response.result?.tools ?? []).map((tool) => tool.name));
    assert.deepEqual(names, new Set([
      'prepare_repository_change',
      'apply_repository_change',
      'verify_repository_change',
      'prepare_working_tree_commit',
      'git_commit_working_tree',
      'prepare_commits',
      'git_commit_files',
    ]));
  });

  test('rejects unsafe paths and checks outside a selected verification profile', async () => {
    const repository = await createRepository();
    repositories.push(repository);
    const server = await startServer(repository);
    servers.push(server);

    const unsafe = payload(await server.call('tools/call', {
      name: 'prepare_repository_change',
      arguments: {
        taskType: 'patch',
        description: 'reject traversal',
        profile: 'app',
        operations: [{ path: '../outside.txt', content: 'nope\n' }],
      },
    }));
    assert.equal(unsafe.status, 'rejected');

    const invalidCheck = payload(await server.call('tools/call', {
      name: 'verify_repository_change',
      arguments: { profile: 'app', checks: ['mcp_test'] },
    }));
    assert.equal(invalidCheck.status, 'rejected');
  });

  test('fails closed outside Git and rejects symlink and sensitive paths', async () => {
    const outsideGit = await mkdtemp(join(tmpdir(), 'operator-synaciel-outside-'));
    await writeFile(join(outsideGit, 'package.json'), '{"name":"outside"}\n');
    try {
      const startup = spawnSync(tsx, [serverEntry], {
        cwd: outsideGit,
        env: { ...process.env, OPERATOR_SYNACIEL_MCP_ROOT: outsideGit },
        encoding: 'utf8',
        shell: false,
      });
      assert.notEqual(startup.status, 0);
      assert.match(`${startup.stdout}\n${startup.stderr}`, /Git (?:root|worktree)/i);
    } finally {
      await rm(outsideGit, { recursive: true, force: true });
    }

    const repository = await createRepository();
    repositories.push(repository);
    await symlink('/tmp/operator-synaciel-outside-target', join(repository, 'src/link.ts'));
    const server = await startServer(repository);
    servers.push(server);

    const symlinkResult = payload(await server.call('tools/call', {
      name: 'prepare_repository_change',
      arguments: {
        taskType: 'patch',
        description: 'reject a symlink path',
        profile: 'app',
        operations: [{ path: 'src/link.ts', content: 'blocked\n' }],
      },
    }));
    assert.equal(symlinkResult.status, 'rejected');

    const sensitiveResult = payload(await server.call('tools/call', {
      name: 'prepare_repository_change',
      arguments: {
        taskType: 'patch',
        description: 'reject an environment path',
        profile: 'app',
        operations: [{ path: 'public/.env', content: 'TOKEN=blocked\n' }],
      },
    }));
    assert.equal(sensitiveResult.status, 'rejected');
    assert.equal(repositoryRoot, process.cwd());
  });
});
