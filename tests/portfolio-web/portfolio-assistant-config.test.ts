import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePortfolioAssistantConfig } from "../../apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts";

test("requires explicit local assistant endpoints instead of falling back to production", () => {
  const config = resolvePortfolioAssistantConfig({ DEV: true, MODE: "development" });

  assert.equal(config.publicAuthOrigin, null);
  assert.equal(config.agentOrigin, null);
  assert.match(config.configurationError ?? "", /VITE_PUBLIC_AUTH_URL/);
  assert.match(config.configurationError ?? "", /VITE_PORTFOLIO_AGENT_URL/);
  assert.doesNotMatch(config.configurationError ?? "", /syn-forge\.com/);
});

test("uses the explicit local origins for a development build", () => {
  const config = resolvePortfolioAssistantConfig({
    DEV: true,
    MODE: "development",
    VITE_PUBLIC_AUTH_URL: "http://localhost:8787/",
    VITE_PORTFOLIO_AGENT_URL: "http://localhost:8788/",
    VITE_TURNSTILE_SITE_KEY: "  local-site-key  ",
  });

  assert.deepEqual(config, {
    publicAuthOrigin: "http://localhost:8787",
    agentOrigin: "http://localhost:8788",
    turnstileSiteKey: "local-site-key",
    configurationError: null,
  });
});

test("keeps production defaults explicit when production overrides are absent", () => {
  const config = resolvePortfolioAssistantConfig({ MODE: "production" });

  assert.equal(config.publicAuthOrigin, "https://public-auth.syn-forge.com");
  assert.equal(config.agentOrigin, "https://assistant.syn-forge.com");
  assert.equal(config.configurationError, null);
});

test("rejects non-http assistant endpoint overrides", () => {
  const config = resolvePortfolioAssistantConfig({
    DEV: true,
    VITE_PUBLIC_AUTH_URL: "javascript:alert(1)",
    VITE_PORTFOLIO_AGENT_URL: "not-a-url",
  });

  assert.equal(config.publicAuthOrigin, null);
  assert.equal(config.agentOrigin, null);
  assert.match(config.configurationError ?? "", /VITE_PUBLIC_AUTH_URL/);
  assert.match(config.configurationError ?? "", /VITE_PORTFOLIO_AGENT_URL/);
});
