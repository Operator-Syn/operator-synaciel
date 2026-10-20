import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  PORTFOLIO_GUIDE,
  PORTFOLIO_GUIDE_VERSION,
} from "../../workers/portfolio-agent/src/portfolio-guide.ts";

const llmsPath = resolve(import.meta.dirname, "../../apps/portfolio-web/public/llms.txt");
const publicRoutes = [
  "/",
  "/projects",
  "/certificates",
  "/snippets",
  "/snippets/document/:id/:slug",
  "/ai",
  "/privacy-policy",
  "/terms-and-conditions",
] as const;

test("keeps the trusted guide compact and versioned", () => {
  assert.equal(PORTFOLIO_GUIDE_VERSION, 1);
  assert.ok(PORTFOLIO_GUIDE.length <= 4_000);
  assert.match(PORTFOLIO_GUIDE, /PORTFOLIO GUIDE v1/);
  assert.match(PORTFOLIO_GUIDE, /not evidence of current owner facts/i);
  assert.doesNotMatch(PORTFOLIO_GUIDE, /John-Ronan|BS Computer Science|Fourth Year/i);
});

test("aligns the guide and public llms manifest on canonical pages", async () => {
  const llms = await readFile(llmsPath, "utf8");
  for (const route of publicRoutes) {
    assert.ok(PORTFOLIO_GUIDE.includes(route), `guide missing ${route}`);
    if (route !== "/") assert.ok(llms.includes(route), `llms.txt missing ${route}`);
  }

  assert.match(PORTFOLIO_GUIDE, /Snippets are not automatically a blog feed/i);
  assert.match(llms, /not automatically a blog feed/i);
  assert.match(PORTFOLIO_GUIDE, /Project records open in the portfolio/i);
  assert.match(llms, /project records do not have individual site routes/i);
  assert.match(PORTFOLIO_GUIDE, /Do not volunteer them as ordinary visitor pages/i);
  assert.doesNotMatch(PORTFOLIO_GUIDE, /NetBird|Atelier|\/netbird|\/atelier|\/agent/i);
  assert.doesNotMatch(llms, /NetBird|Atelier|\/netbird|\/atelier|\/agent/i);
});

test("encodes answer-first, onboarding, terminology, and format behavior", () => {
  assert.match(PORTFOLIO_GUIDE, /answer it directly before asking/i);
  assert.match(PORTFOLIO_GUIDE, /Do not ask which internal retrieval flow/i);
  assert.match(PORTFOLIO_GUIDE, /make one useful bounded lookup/i);
  assert.match(
    PORTFOLIO_GUIDE,
    /For collection-wide requests, paginate until the collection is complete/i,
  );
  assert.match(PORTFOLIO_GUIDE, /requested JSON or another concrete format/i);
  assert.match(
    PORTFOLIO_GUIDE,
    /A successful tool call supports only the claims it actually covers/i,
  );
  assert.match(PORTFOLIO_GUIDE, /Do not name internal tools/i);
});
