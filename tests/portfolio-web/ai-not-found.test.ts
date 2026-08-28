import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  PORTFOLIO_MCP_ENDPOINT,
  PORTFOLIO_MCP_ONBOARDING_PROMPT,
  PORTFOLIO_MCP_SERVER_NAME,
  PORTFOLIO_MCP_TRANSPORT,
} from "../../apps/portfolio-web/src/data/portfolioMcp.ts";

const appRoot = resolve(import.meta.dirname, "../../apps/portfolio-web");

test("keeps the AI guide's onboarding path complete and source-grounded", async () => {
  const aiPage = await readFile(resolve(appRoot, "src/components/pages/aiPage/Ai.tsx"), "utf8");

  assert.match(aiPage, /href="#ai-onboarding"/);
  assert.match(aiPage, /id="ai-onboarding"/);
  assert.match(aiPage, /PORTFOLIO_MCP_ONBOARDING_PROMPT/);
  assert.match(aiPage, /navigator\.clipboard\?\.writeText/);
  assert.match(aiPage, /aria-live="polite"/);
  assert.ok(PORTFOLIO_MCP_ONBOARDING_PROMPT.includes(PORTFOLIO_MCP_ENDPOINT));
  assert.ok(PORTFOLIO_MCP_ONBOARDING_PROMPT.includes(PORTFOLIO_MCP_SERVER_NAME));
  assert.ok(PORTFOLIO_MCP_ONBOARDING_PROMPT.includes(PORTFOLIO_MCP_TRANSPORT));
  assert.match(PORTFOLIO_MCP_ONBOARDING_PROMPT, /Authentication: none/);
  assert.match(PORTFOLIO_MCP_ONBOARDING_PROMPT, /Access: read-only/);
  assert.match(PORTFOLIO_MCP_ONBOARDING_PROMPT, /Do not install packages/);
  assert.doesNotMatch(PORTFOLIO_MCP_ONBOARDING_PROMPT, /John-Ronan/);
});

test("routes unknown paths to a recoverable generic 404 page", async () => {
  const [app, notFound, head] = await Promise.all([
    readFile(resolve(appRoot, "src/App.tsx"), "utf8"),
    readFile(resolve(appRoot, "src/components/pages/notFoundPage/NotFound.tsx"), "utf8"),
    readFile(resolve(appRoot, "src/components/globalHeadManager/GlobalHeadManager.tsx"), "utf8"),
  ]);

  assert.match(app, /import NotFound from ".\/components\/pages\/notFoundPage\/NotFound"/);
  assert.match(app, /<Route path="\*" element={<NotFound \/>} \/>/);
  assert.match(notFound, /useLocation/);
  assert.match(notFound, /robots="noindex, nofollow"/);
  assert.match(notFound, /requestedPath/);
  assert.match(notFound, /to="\/"[^>]*>/);
  assert.match(notFound, /to="\/ai"[^>]*>/);
  assert.match(head, /robotsTag\.content = "index, follow"/);
});
