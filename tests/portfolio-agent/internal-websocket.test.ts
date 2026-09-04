import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../");
const workerPath = resolve(repositoryRoot, "workers/portfolio-agent/src/index.ts");

test("keeps the internal WebSocket route behind the service-binding key", async () => {
  const source = await readFile(workerPath, "utf8");

  assert.match(
    source,
    /const expected = `Bearer \$\{getConfigString\(environment, "AGENT", "INTERNAL", "KEY"\)\}`;[\s\S]*?if \(request\.headers\.get\("Authorization"\) !== expected\)[\s\S]*?return Response\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/,
  );
  assert.match(
    source,
    /const isInternalAgentRoute = url\.pathname\.startsWith\("\/internal\/agents\/portfolio-agent\/"\)/,
  );
  assert.match(
    source,
    /const isInternalThreadRoute = url\.pathname\.startsWith\("\/internal\/threads\/"\)/,
  );
  assert.match(source, /if \(!isInternalAgentRoute && !isInternalThreadRoute\) return null/);
  assert.match(source, /internalAgentWebSocketRequest\(request, environment\)/);
  assert.match(source, /request\.headers\.get\("Upgrade"\)\?\.toLowerCase\(\) !== "websocket"/);
  assert.match(source, /status: 426/);
});

test("validates the trusted identity handoff and binds it to the requested thread", async () => {
  const source = await readFile(workerPath, "utf8");

  assert.match(
    source,
    /parseAgentIdentity\(request\.headers\.get\(AGENT_IDENTITY_HEADER\), threadId\)/,
  );
  assert.match(source, /status: 401/);
  assert.match(source, /targetUrl\.pathname = `\/agents\/portfolio-agent\//);
  assert.match(source, /targetUrl\.search = ""/);
  assert.match(source, /targetUrl\.searchParams\.set\("_pk", connectionId\)/);
  assert.match(source, /headers\.delete\("Authorization"\)/);
  assert.match(source, /headers\.delete\("Cookie"\)/);
  assert.match(source, /headers\.delete\(AGENT_REQUEST_ID_HEADER\)/);
  assert.match(source, /props: requestId \? \{ \.\.\.identity, requestId \} : identity/);
});

test("keeps the public agent route retired", async () => {
  const source = await readFile(workerPath, "utf8");
  assert.doesNotMatch(source, /async function authenticatedRoute/);
  assert.doesNotMatch(source, /searchParams\.get\("token"\)/);
  assert.match(source, /if \(internal\) return internal;[\s\S]*?status: 404/);
});
