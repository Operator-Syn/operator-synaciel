import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  AGENT_IDENTITY_HEADER,
  AGENT_REQUEST_ID_HEADER,
  encodeAgentIdentity,
  normalizeAgentRequestId,
  parseAgentIdentity,
} from "../../workers/portfolio-agent/src/identity.ts";

const identity = { sub: "google-sub", sid: "session-hash", tid: "ThreadPGNELW", q: 3 };
const agentPath = resolve(import.meta.dirname, "../../workers/portfolio-agent/src/agent.ts");
const workerPath = resolve(import.meta.dirname, "../../workers/portfolio-agent/src/index.ts");

test("round-trips the verified identity handoff used after history-first startup", () => {
  const header = encodeAgentIdentity(identity);

  assert.equal(AGENT_IDENTITY_HEADER, "x-portfolio-agent-identity");
  assert.equal(AGENT_REQUEST_ID_HEADER, "x-portfolio-agent-request-id");
  assert.deepEqual(parseAgentIdentity(header, identity.tid), identity);
  assert.equal(normalizeAgentRequestId("attempt_123456789012"), "attempt_123456789012");
  assert.equal(normalizeAgentRequestId("not safe"), undefined);
});

test("rejects malformed or cross-thread identity handoffs", () => {
  assert.equal(parseAgentIdentity(null, identity.tid), null);
  assert.equal(parseAgentIdentity("not-json", identity.tid), null);
  assert.equal(parseAgentIdentity(encodeAgentIdentity(identity), "OtherThread"), null);
  assert.equal(parseAgentIdentity(JSON.stringify({ ...identity, q: "3" }), identity.tid), null);
});

test("passes verified claims to the DO when history initialized it first", async () => {
  const [agentSource, workerSource] = await Promise.all([
    readFile(agentPath, "utf8"),
    readFile(workerPath, "utf8"),
  ]);

  assert.match(agentSource, /static options = \{ hibernate: true, sendIdentityOnConnect: false \}/);
  const onStartSource = agentSource.slice(
    agentSource.indexOf("async onStart("),
    agentSource.indexOf("  onConnect("),
  );
  assert.doesNotMatch(onStartSource, /ensureMcpConnection/);
  assert.match(agentSource, /onConnect\([\s\S]*?parseAgentIdentity\(/);
  assert.match(agentSource, /persistIdentity\(identity\)/);
  assert.match(agentSource, /AGENT_REQUEST_ID_HEADER/);
  assert.match(
    workerSource,
    /parseAgentIdentity\(request\.headers\.get\(AGENT_IDENTITY_HEADER\), threadId\)/,
  );
  assert.match(workerSource, /props: requestId \? \{ \.\.\.identity, requestId \} : identity/);
});
