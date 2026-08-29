import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../");
const appPath = resolve(repositoryRoot, "apps/portfolio-web/src/App.tsx");
const fabPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx",
);
const apiPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts",
);
const configPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts",
);
const cssPath = resolve(
  repositoryRoot,
  "apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistant.css",
);

test("mounts the portfolio assistant globally with bounded authenticated chat controls", async () => {
  const [appSource, fabSource, apiSource, configSource, cssSource] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(fabPath, "utf8"),
    readFile(apiPath, "utf8"),
    readFile(configPath, "utf8"),
    readFile(cssPath, "utf8"),
  ]);

  assert.match(appSource, /<PortfolioAssistantFab \/>/);
  assert.match(fabSource, /useAgentChat/);
  assert.match(fabSource, /useAgent/);
  assert.match(fabSource, /cacheTtl: 0/);
  assert.match(fabSource, /turnstile/);
  assert.match(fabSource, /New assistant thread/);
  assert.match(fabSource, /Export assistant thread/);
  assert.match(fabSource, /Delete assistant thread/);
  assert.match(fabSource, /Context compacted/);
  assert.match(apiSource, /"\/agent\/token"/);
  assert.match(apiSource, /"\/threads"/);
  assert.match(configSource, /VITE_PUBLIC_AUTH_URL/);
  assert.match(configSource, /VITE_PORTFOLIO_AGENT_URL/);
  assert.match(configSource, /required for local development/);
  assert.doesNotMatch(apiSource, /public-auth\.syn-forge\.com/);
  assert.doesNotMatch(fabSource, /assistant\.syn-forge\.com/);
  assert.match(cssSource, /portfolio-assistant-fab/);
  assert.match(cssSource, /prefers-reduced-motion/);
  assert.doesNotMatch(fabSource, /auth_token/);
  assert.doesNotMatch(apiSource, /localStorage|sessionStorage/);
});
