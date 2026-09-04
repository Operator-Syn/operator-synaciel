import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectBrowserUrl, isLocalViteHmrWebSocket } from "./playwright-observability.ts";

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

test("allowlists only the local Vite HMR token socket", () => {
  assert.equal(isLocalViteHmrWebSocket("ws://127.0.0.1:5173/?token=dev-hmr-token"), true);
  assert.equal(isLocalViteHmrWebSocket("ws://localhost:5173/?token=dev-hmr-token"), true);

  for (const url of [
    "wss://public-auth.syn-forge.com/agents/portfolio-agent/ThreadGateway123?token=dev-hmr-token",
    "ws://127.0.0.1:5173/?token=dev-hmr-token&rid=attempt",
    "wss://127.0.0.1:5173/?token=dev-hmr-token",
    "ws://127.0.0.1:5174/?token=dev-hmr-token",
  ]) {
    assert.equal(isLocalViteHmrWebSocket(url), false, url);
  }
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
