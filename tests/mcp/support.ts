import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export type JsonRpcMessage = {
  readonly id?: number;
  readonly result?: {
    readonly content?: readonly { readonly text?: string }[];
    readonly tools?: readonly { readonly name: string }[];
    readonly isError?: boolean;
  };
  readonly error?: { readonly message?: string };
};

type TestServer = {
  readonly call: (method: string, params?: unknown) => Promise<JsonRpcMessage>;
  readonly close: () => Promise<void>;
};

export const repositoryRoot = resolve(process.cwd());
export const tsx = resolve(repositoryRoot, 'node_modules/.bin/tsx');
export const serverEntry = resolve(repositoryRoot, 'mcp/server.ts');

export function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync('git', [...args], { cwd, encoding: 'utf8', shell: false });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error instanceof Error ? result.error.message : ''),
  };
}

export function requireGit(cwd: string, args: readonly string[]): string {
  const result = runGit(cwd, args);
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export async function createRepository(): Promise<string> {
  const repository = await mkdtemp(join(tmpdir(), 'operator-synaciel-mcp-'));
  if (runGit(repository, ['init', '--quiet']).status !== 0) throw new Error('Could not initialize test repository.');
  requireGit(repository, ['config', 'user.email', 'test@example.invalid']);
  requireGit(repository, ['config', 'user.name', 'Operator MCP Test']);
  await mkdir(join(repository, 'src'), { recursive: true });
  await writeFile(join(repository, 'package.json'), '{"name":"fixture","private":true}\n');
  await writeFile(join(repository, 'src/one.ts'), 'one before\n');
  requireGit(repository, ['add', '--all']);
  requireGit(repository, ['commit', '--quiet', '-m', 'Create the initial fixture state.']);
  requireGit(repository, ['config', 'core.hooksPath', resolve(repositoryRoot, '.githooks')]);
  return repository;
}

export async function removeRepository(repository: string): Promise<void> {
  await rm(repository, { recursive: true, force: true });
}

export async function startServer(repository: string): Promise<TestServer> {
  const child = spawn(tsx, [serverEntry], {
    cwd: repository,
    env: { ...process.env, OPERATOR_SYNACIEL_MCP_ROOT: repository },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let nextId = 1;
  let buffer = '';
  const pending = new Map<number, (message: JsonRpcMessage) => void>();
  const failures = new Map<number, (error: Error) => void>();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    for (const line of buffer.split(/\r?\n/).slice(0, -1)) {
      if (!line.trim()) continue;
      const message = JSON.parse(line) as JsonRpcMessage;
      if (message.id === undefined) continue;
      const resolveMessage = pending.get(message.id);
      const rejectMessage = failures.get(message.id);
      if (resolveMessage) {
        pending.delete(message.id);
        failures.delete(message.id);
        resolveMessage(message);
      } else if (rejectMessage) {
        pending.delete(message.id);
        failures.delete(message.id);
        rejectMessage(new Error(message.error?.message ?? 'MCP request failed.'));
      }
    }
    const lastNewline = buffer.lastIndexOf('\n');
    buffer = lastNewline >= 0 ? buffer.slice(lastNewline + 1) : buffer;
  });
  child.stderr.resume();

  const call = (method: string, params?: unknown): Promise<JsonRpcMessage> => {
    const id = nextId++;
    return new Promise((resolveMessage, rejectMessage) => {
      pending.set(id, resolveMessage);
      failures.set(id, rejectMessage);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} })}\n`);
    });
  };

  await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'operator-synaciel-test', version: '1.0.0' },
  });
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\n');

  return {
    call,
    close: async () => {
      child.stdin.end();
      await new Promise<void>((resolveClose) => child.once('close', () => resolveClose()));
    },
  };
}

export function payload(message: JsonRpcMessage): Record<string, unknown> {
  const text = message.result?.content?.[0]?.text;
  if (!text) throw new Error(`MCP response did not contain a JSON payload: ${JSON.stringify(message)}`);
  return JSON.parse(text) as Record<string, unknown>;
}
