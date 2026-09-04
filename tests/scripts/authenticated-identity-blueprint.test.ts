import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const blueprintRoot = resolve(repositoryRoot, "docs/authenticated-identity-blueprint");

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(resolve(repositoryRoot, path), "utf8");
}

test("keeps the authenticated identity blueprint aligned with its adapter", async () => {
  const blueprintFiles = await collectFiles(blueprintRoot);
  const markdownFiles = blueprintFiles.filter((path) => path.endsWith(".md"));
  const corpus = (await Promise.all(markdownFiles.map((path) => readFile(path, "utf8")))).join(
    "\n",
  );
  const index = await readFile(resolve(blueprintRoot, "README.md"), "utf8");

  for (const requiredFile of [
    "README.md",
    "CONTEXT.md",
    "01-vocabulary-and-trust-boundaries.md",
    "02-authentication-and-session-lifecycle.md",
    "03-identity-handoff-and-authorization.md",
    "04-protected-realtime-gateway.md",
    "05-stateful-runtime-and-hibernation.md",
    "06-observability-redaction-and-testing.md",
    "07-rollout-revocation-and-recovery.md",
    "08-cloudflare-adapter.md",
    "09-sequential-checkpoints.md",
    "audits/repository-map.md",
    "audits/evidence-ledger.md",
    "audits/unresolved-questions.md",
    "references/standards-and-platforms.md",
  ]) {
    assert.ok(
      blueprintFiles.includes(resolve(blueprintRoot, requiredFile)),
      `Blueprint is missing required note: ${requiredFile}`,
    );
  }

  for (const placeholder of [
    "{{SESSION_STORE}}",
    "{{GATEWAY}}",
    "{{STATEFUL_RUNTIME}}",
    "{{INTERNAL_CHANNEL}}",
    "{{RESOURCE_ID}}",
  ]) {
    assert.ok(
      corpus.includes(placeholder),
      `Blueprint is missing universal placeholder: ${placeholder}`,
    );
  }
  assert.match(index, /program-agnostic|reusable/i);
  assert.match(index, /evidence/i);
  assert.match(corpus, /historical.*token.*table/i);

  const [publicAuth, agentIndex, agentSource, frontendFab, frontendApi, frontendConfig] =
    await Promise.all([
      readRepositoryFile("workers/portfolio-public-auth/src/index.ts"),
      readRepositoryFile("workers/portfolio-agent/src/index.ts"),
      readRepositoryFile("workers/portfolio-agent/src/agent.ts"),
      readRepositoryFile(
        "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
      ),
      readRepositoryFile(
        "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts",
      ),
      readRepositoryFile(
        "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts",
      ),
    ]);

  assert.ok(publicAuth.includes('app.post("/agent/prepare"'));
  assert.ok(publicAuth.includes('app.get("/agents/portfolio-agent/:id"'));
  assert.ok(agentIndex.includes("/internal/agents/portfolio-agent/"));
  assert.ok(agentIndex.includes("AGENT_IDENTITY_HEADER"));
  assert.ok(agentIndex.includes("AGENT_REQUEST_ID_HEADER"));
  assert.ok(agentIndex.includes('headers.delete("Cookie")'));
  assert.ok(agentIndex.includes('headers.delete("Authorization")'));
  assert.ok(!publicAuth.includes('app.post("/agent/token"'));
  assert.ok(!agentIndex.includes('searchParams.get("token")'));

  assert.ok(
    agentSource.includes("static options = { hibernate: true, sendIdentityOnConnect: false }"),
  );
  const onStart = agentSource.slice(
    agentSource.indexOf("async onStart("),
    agentSource.indexOf("  onConnect("),
  );
  assert.ok(!onStart.includes("ensureMcpConnection"));
  assert.ok(!onStart.includes("fetch("));

  assert.ok(frontendFab.includes("host: publicAuthOrigin"));
  assert.ok(frontendFab.includes("rid"));
  assert.ok(frontendFab.includes("maxRetries: 3"));
  assert.ok(frontendFab.includes("connectionTimeout: 10_000"));
  assert.ok(frontendApi.includes('"/agent/prepare"'));
  assert.ok(!frontendApi.includes('"/agent/token"'));
  assert.ok(!frontendConfig.includes("VITE_PORTFOLIO_AGENT_URL"));
  assert.ok(!frontendConfig.includes("PRODUCTION_AGENT_ORIGIN"));

  for (const sourcePath of [
    "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
    "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts",
    "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts",
    "workers/portfolio-public-auth/src/index.ts",
    "workers/portfolio-public-auth/src/config.ts",
    "workers/portfolio-agent/src/index.ts",
    "workers/portfolio-agent/src/identity.ts",
    "workers/portfolio-agent/src/agent.ts",
    "workers/portfolio-agent/src/mcp.ts",
    "workers/portfolio-agent/src/diagnostics.ts",
    "workers/portfolio-public-auth/wrangler.toml",
    "workers/portfolio-agent/wrangler.toml",
    "tests/portfolio-public-auth/agent-gateway.test.ts",
    "tests/portfolio-agent/internal-websocket.test.ts",
    "tests/portfolio-agent/identity.test.ts",
    "tests/portfolio-web/playwright-observability.ts",
    "tests/portfolio-web/google-authenticated.spec.ts",
  ]) {
    const shortPath = sourcePath.replace(/^.*?\//, "");
    assert.ok(
      corpus.includes(sourcePath) || corpus.includes(shortPath),
      `Blueprint is missing adapter source mapping: ${sourcePath}`,
    );
  }

  const map = await readFile(resolve(blueprintRoot, "audits/repository-map.md"), "utf8");
  const ledger = await readFile(resolve(blueprintRoot, "audits/evidence-ledger.md"), "utf8");
  assert.match(map, /Graphify/i);
  assert.match(ledger, /verified-repository|verified-external|verified-live/);
  assert.ok(relative(repositoryRoot, blueprintRoot).startsWith("docs/"));
});
