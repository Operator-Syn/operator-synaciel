import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const agentPath = resolve(import.meta.dirname, "../../workers/portfolio-agent/src/agent.ts");
const evidencePath = resolve(import.meta.dirname, "../../workers/portfolio-agent/src/evidence.ts");
const limitsPath = resolve(import.meta.dirname, "../../workers/portfolio-agent/src/limits.ts");
const mcpSearchPath = resolve(import.meta.dirname, "../../workers/portfolio-mcp/src/mcp/search.ts");

test("uses model-led conversational routing instead of vocabulary catalogs", async () => {
  const [agentSource, evidenceSource, limitsSource, mcpSearchSource] = await Promise.all([
    readFile(agentPath, "utf8"),
    readFile(evidencePath, "utf8"),
    readFile(limitsPath, "utf8"),
    readFile(mcpSearchPath, "utf8"),
  ]);

  assert.doesNotMatch(
    evidenceSource,
    /QUERY_STOP_WORDS|KIND_ALIASES|PRECISION_PATTERN|KNOWN_TECHNOLOGY_TERMS|PORTFOLIO_SCOPE_TERMS|classifyGroundingQuestion|hasPortfolioScopeSignal/,
  );
  assert.doesNotMatch(
    limitsSource,
    /GITHUB_TOOL_SUFFIXES|requiresGitHubContext|requiresPortfolioOverview/,
  );
  assert.doesNotMatch(
    mcpSearchSource,
    /SEARCH_STOP_WORDS|SEARCH_KIND_ALIASES|acceptsKind|requestedKind/,
  );
  assert.doesNotMatch(
    agentSource,
    /preflight|renderPreciseEvidenceBlock|groundedAnswerSchema|validateGroundedAnswer/,
  );
  assert.doesNotMatch(
    agentSource,
    /executeMcpTool|groundingQuery|searchEvidence|overviewEvidence|hasSearchEvidence|failure:\s*["']out-of-scope["']/,
  );
  assert.doesNotMatch(agentSource, /reasoning:\s*["']minimal["']/);
  assert.match(agentSource, /(?:const|let) selectedTools = selectPortfolioTools\(rawTools\)/);
  assert.match(agentSource, /convertToModelMessages\([\s\S]*?tools:\s*selectedTools/);
  assert.match(agentSource, /streamText\(\{[\s\S]*?tools:\s*selectedTools/);
  assert.match(agentSource, /prepareStep:\s*\(\)\s*=>/);
  assert.match(agentSource, /toolChoice:\s*portfolioToolChoice\(evidenceState\)/);
});
