import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePortfolioAssistantConfig } from "../../apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts";

test("requires an explicit local public-auth endpoint instead of falling back to production", () => {
  const config = resolvePortfolioAssistantConfig({ DEV: true, MODE: "development" });

  assert.equal(config.publicAuthOrigin, null);
  assert.match(config.configurationError ?? "", /VITE_PUBLIC_AUTH_URL/);
  assert.doesNotMatch(config.configurationError ?? "", /syn-forge\.com/);
});

test("uses the explicit local public-auth origin for a development build", () => {
  const config = resolvePortfolioAssistantConfig({
    DEV: true,
    MODE: "development",
    VITE_PUBLIC_AUTH_URL: "http://localhost:8787/",
    VITE_TURNSTILE_SITE_KEY: "  local-site-key  ",
  });

  assert.deepEqual(config, {
    publicAuthOrigin: "http://localhost:8787",
    turnstileSiteKey: "local-site-key",
    configurationError: null,
  });
});

test("keeps the production public-auth default explicit when overrides are absent", () => {
  const config = resolvePortfolioAssistantConfig({ MODE: "production" });

  assert.equal(config.publicAuthOrigin, "https://public-auth.syn-forge.com");
  assert.equal(config.configurationError, null);
});

test("rejects a non-http public-auth endpoint override", () => {
  const config = resolvePortfolioAssistantConfig({
    DEV: true,
    VITE_PUBLIC_AUTH_URL: "javascript:alert(1)",
  });

  assert.equal(config.publicAuthOrigin, null);
  assert.match(config.configurationError ?? "", /VITE_PUBLIC_AUTH_URL/);
});
