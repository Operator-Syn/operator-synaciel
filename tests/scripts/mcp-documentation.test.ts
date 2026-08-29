import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function readRepositoryFile(relativePath: string) {
  return readFile(resolve(repositoryRoot, relativePath), "utf8");
}

const publicSourceFiles = [
  "workers/portfolio-mcp/src/config.ts",
  "workers/portfolio-mcp/src/github/client.ts",
  "workers/portfolio-mcp/src/github/index.ts",
  "workers/portfolio-mcp/src/github/transport.ts",
  "workers/portfolio-mcp/src/github/types.ts",
  "workers/portfolio-mcp/src/github/urls.ts",
  "workers/portfolio-mcp/src/mcp/handler.ts",
  "workers/portfolio-mcp/src/mcp/links.ts",
  "workers/portfolio-mcp/src/mcp/resources.ts",
  "workers/portfolio-mcp/src/mcp/results.ts",
  "workers/portfolio-mcp/src/mcp/schemas.ts",
  "workers/portfolio-mcp/src/mcp/search.ts",
  "workers/portfolio-mcp/src/mcp/server.ts",
  "workers/portfolio-mcp/src/mcp/snippets.ts",
  "workers/portfolio-mcp/src/mcp/tools/certificates.ts",
  "workers/portfolio-mcp/src/mcp/tools/github.ts",
  "workers/portfolio-mcp/src/mcp/tools/index.ts",
  "workers/portfolio-mcp/src/mcp/tools/overview.ts",
  "workers/portfolio-mcp/src/mcp/tools/projects.ts",
  "workers/portfolio-mcp/src/mcp/tools/search.ts",
  "workers/portfolio-mcp/src/mcp/tools/snippets.ts",
  "workers/portfolio-mcp/src/mcp/validation.ts",
  "workers/portfolio-mcp/src/worker.ts",
  "workers/portfolio-mcp/src/portfolio-api/client.ts",
  "workers/portfolio-mcp/src/portfolio-api/errors.ts",
  "workers/portfolio-mcp/src/portfolio-api/index.ts",
  "workers/portfolio-mcp/src/portfolio-api/snippets.ts",
  "workers/portfolio-mcp/src/portfolio-api/transport.ts",
  "workers/portfolio-mcp/src/portfolio-api/types.ts",
  "workers/portfolio-mcp/src/portfolio-api/urls.ts",
];

test("keeps public and local MCP documentation aligned with their boundaries", async () => {
  const [
    publicEntrypoint,
    publicSource,
    publicApiBarrel,
    publicDocumentation,
    moduleDocumentation,
    discoveryFile,
    publicWorkerConfig,
    localSource,
    localToolSource,
    localDocumentation,
    localPolicy,
    localPath,
    localSessionHook,
    commitGate,
    documentationMap,
    config,
    codexConfig,
  ] = await Promise.all([
    readRepositoryFile("workers/portfolio-mcp/src/index.ts"),
    Promise.all(publicSourceFiles.map((file) => readRepositoryFile(file))).then((sources) =>
      sources.join("\n"),
    ),
    readRepositoryFile("workers/portfolio-mcp/src/portfolioApi.ts"),
    readRepositoryFile("docs/architecture/portfolio-mcp.md"),
    readRepositoryFile("docs/architecture/portfolio-mcp-modules.md"),
    readRepositoryFile("apps/portfolio-web/public/llms.txt"),
    readRepositoryFile("workers/portfolio-mcp/wrangler.toml"),
    readRepositoryFile("tools/repository-mcp/src/server.ts"),
    readRepositoryFile("tools/repository-mcp/src/tools/repository.ts"),
    readRepositoryFile("docs/operations/repository-mcp.md"),
    readRepositoryFile("tools/repository-mcp/src/policy.ts"),
    readRepositoryFile("tools/repository-mcp/src/path.ts"),
    readRepositoryFile(".codex/hooks/repository-session-start.sh"),
    readRepositoryFile(".codex/hooks/repository-commit-gate.mjs"),
    readRepositoryFile("docs/README.md"),
    readRepositoryFile(".mcp.json"),
    readRepositoryFile(".codex/config.toml"),
  ]);

  const endpoint = publicSource.match(/PORTFOLIO_MCP_ENDPOINT = "([^"]+)"/)?.[1];
  const serverName = publicSource.match(/PORTFOLIO_MCP_SERVER_NAME = "([^"]+)"/)?.[1];
  assert.ok(endpoint);
  assert.ok(serverName);
  assert.match(publicSource, /createMcpHandler/);
  assert.doesNotMatch(publicEntrypoint, /new McpServer|registerTool|registerResource/);
  assert.match(publicApiBarrel, /^export \* from "\.\/portfolio-api\/index\.ts";$/m);
  assert.match(publicDocumentation, /^# Public Portfolio MCP \(Streamable HTTP\)$/m);
  assert.match(moduleDocumentation, /^# Public Portfolio MCP Module Structure$/m);
  assert.match(moduleDocumentation, /src\/portfolio-api\/transport\.ts/);
  assert.match(
    publicDocumentation,
    /\[\[architecture\/portfolio-mcp-modules\|Public Portfolio MCP module structure\]\]/,
  );
  assert.ok(publicDocumentation.includes(endpoint));
  assert.ok(publicDocumentation.includes(serverName));
  assert.match(
    publicDocumentation,
    /\[\[operations\/repository-mcp\|Local Repository MCP \(stdio\)/,
  );
  assert.match(discoveryFile, /Transport: Streamable HTTP/);
  assert.ok(discoveryFile.includes(endpoint));
  assert.ok(discoveryFile.includes(serverName));
  assert.match(discoveryFile, /Operator-Syn/);
  assert.doesNotMatch(discoveryFile, /John-Ronan/);
  assert.match(publicSource, /Operator-Syn/);
  assert.doesNotMatch(publicSource, /John-Ronan/);
  assert.match(publicWorkerConfig, /binding = "PORTFOLIO_API"/);
  assert.match(publicWorkerConfig, /service = "portfolio-api"/);
  assert.match(publicWorkerConfig, /pattern = "mcp\.syn-forge\.com"/);
  assert.match(publicSource, /outputSchema:/);
  assert.match(publicSource, /structuredContent/);
  assert.match(publicSource, /readOnlyHint: true/);
  assert.match(publicDocumentation, /outputSchema/);
  assert.match(publicDocumentation, /structuredContent/);
  assert.match(
    documentationMap,
    /\[\[architecture\/portfolio-mcp\|Public Portfolio MCP \(Streamable HTTP\)\]\]/,
  );
  assert.match(
    documentationMap,
    /\[\[architecture\/portfolio-mcp-modules\|Public Portfolio MCP module structure\]\]/,
  );
  assert.match(
    documentationMap,
    /\[\[operations\/repository-mcp\|Local Repository MCP \(stdio\)\]\]/,
  );

  const toolNames = [...publicSource.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(toolNames.length > 0);
  for (const toolName of toolNames) {
    assert.ok(toolName);
    assert.ok(publicDocumentation.includes(`\`${toolName}\``));
    assert.ok(discoveryFile.includes(toolName));
  }

  const resourceUris = [...publicSource.matchAll(/"(portfolio:\/\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(resourceUris.length > 0);
  for (const resourceUri of resourceUris) {
    assert.ok(resourceUri);
    assert.ok(publicDocumentation.includes(`\`${resourceUri}\``));
  }

  assert.match(localSource, /new StdioServerTransport\(\)/);
  assert.match(localToolSource, /outputSchema:/);
  assert.match(localToolSource, /structuredContent/);
  assert.match(localDocumentation, /^# Local Repository MCP \(stdio\) and Commit Pipeline$/m);
  assert.match(localDocumentation, /outputSchema/);
  assert.match(localDocumentation, /structuredContent/);
  assert.match(localDocumentation, /no public HTTP endpoint/);
  assert.match(localDocumentation, /read_repository_change_diff/);
  assert.match(localDocumentation, /read_working_tree_diff/);
  assert.match(localDocumentation, /read_repository_files/);
  assert.match(localDocumentation, /mcp-fast/);
  assert.match(localDocumentation, /repository_workflow_status/);
  assert.match(localDocumentation, /verificationRequired/);
  assert.match(localDocumentation, /context-filter/);
  assert.match(localDocumentation, /repository.*broadest/);
  assert.match(localDocumentation, /workers\/portfolio-api\//);
  assert.match(localDocumentation, /1,000,000 bytes/);
  assert.match(localDocumentation, /binary/);
  assert.match(localDocumentation, /api_typecheck/);
  assert.match(localToolSource, /read_repository_change_diff/);
  assert.match(localToolSource, /read_working_tree_diff/);
  assert.match(localToolSource, /read_repository_files/);
  assert.match(localToolSource, /repository profile/);
  assert.match(localPolicy, /MAX_PREPARED_FILES = 20/);
  assert.match(localPolicy, /MAX_SOURCE_READ_RESPONSE_CHARACTERS/);
  assert.match(localPolicy, /MAX_VERIFICATION_CHECKS = 20/);
  assert.match(localPolicy, /repository:/);
  assert.match(localPolicy, /api_typecheck/);
  assert.match(localPath, /MAX_FILE_BYTES = 1_000_000/);
  assert.match(localPolicy, /mcp-fast/);
  assert.match(localSessionHook, /Start with repository_workflow_status/);
  assert.match(localSessionHook, /context_filter/);
  assert.match(commitGate, /containsGitCommitInvocation/);
  assert.match(
    localDocumentation,
    /\[\[architecture\/portfolio-mcp\|Public Portfolio MCP \(Streamable HTTP\)/,
  );
  assert.match(config, /"operator-synaciel-repository"/);
  assert.equal(config.includes(endpoint), false);
  assert.equal(codexConfig.includes(endpoint), false);
});
