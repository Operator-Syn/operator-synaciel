import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectBrowserUrl } from "./playwright-observability.ts";

test("redacts credential values and JWT-shaped URLs before recording browser events", () => {
  const inspection = inspectBrowserUrl(
    "wss://public-auth.syn-forge.com/agents/portfolio-agent/ThreadGateway123?token=eyJheader.payload.signature&rid=attempt_123456789012",
  );

  assert.equal(inspection.credentialExposed, true);
  assert.equal(
    inspection.safeUrl,
    "wss://public-auth.syn-forge.com/agents/portfolio-agent/ThreadGateway123?rid&token",
  );
  assert.doesNotMatch(inspection.safeUrl, /eyJ|payload|signature|attempt_123456789012/);
});

test("keeps only query parameter names for a non-sensitive browser URL", () => {
  const inspection = inspectBrowserUrl(
    "https://public-auth.syn-forge.com/agents/portfolio-agent/ThreadGateway123?rid=attempt_123456789012&_pk=connection-key",
  );

  assert.equal(inspection.credentialExposed, false);
  assert.equal(
    inspection.safeUrl,
    "https://public-auth.syn-forge.com/agents/portfolio-agent/ThreadGateway123?_pk&rid",
  );
});
