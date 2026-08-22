#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './policy.ts';
import { validateLocalProjectRoot } from './path.ts';
import { registerRepositoryTools } from './tools/repository.ts';

export function createOperatorSynacielRepositoryServer(): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
  registerRepositoryTools(server);
  return server;
}

async function main(): Promise<void> {
  const root = await validateLocalProjectRoot();
  if (!root.valid) throw new Error(root.reason);
  const server = createOperatorSynacielRepositoryServer();
  await server.connect(new StdioServerTransport());
  console.error('Operator-Synaciel repository MCP server running on stdio');
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    console.error('Operator-Synaciel repository MCP server failed to start:', error);
    process.exitCode = 1;
  });
}
