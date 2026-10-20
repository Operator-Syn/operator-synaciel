import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioEvidenceSnapshot,
  MAX_EVIDENCE_SNAPSHOT_CHARACTERS,
  PRIOR_EVIDENCE_TTL_MS,
  type StoredPortfolioEvidence,
  seedPortfolioEvidenceState,
} from "../../workers/portfolio-agent/src/evidence.ts";
import type { McpTool } from "../../workers/portfolio-agent/src/limits.ts";
import {
  createThreadEvidenceStore,
  type EvidenceSql,
  ensureThreadEvidenceSchema,
  evidenceFromToolResult,
  prefetchPortfolioOverview,
} from "../../workers/portfolio-agent/src/thread-evidence.ts";

function createSql(initialRow: Record<string, unknown> | null = null) {
  let row = initialRow;
  const queries: string[] = [];
  const sql: EvidenceSql = (query, ...values) => {
    const text = query.join("?");
    queries.push(text);
    if (text.startsWith("SELECT")) return row ? [row] : [];
    if (text.startsWith("INSERT")) {
      row = { snapshot: values[0], sources_json: values[1], captured_at: values[2] };
    }
    return [];
  };
  return { sql, queries, getRow: () => row };
}

function tool(execute: McpTool["execute"]): McpTool {
  return { inputSchema: {}, execute };
}

const overviewResult = {
  structuredContent: {
    site: { headerPhrase: "Build with intent" },
    profile: [{ label: "Role", value: "Software developer" }],
    sections: [],
  },
};

test("persists only fresh, valid thread evidence", () => {
  const now = 1_000_000;
  const fixture = createSql();
  ensureThreadEvidenceSchema(fixture.sql);
  assert.ok(fixture.queries.some((query) => query.includes("CREATE TABLE")));

  const store = createThreadEvidenceStore(fixture.sql);
  const evidence: StoredPortfolioEvidence = {
    snapshot: '{"tool":"get_portfolio_overview"}',
    sources: [{ url: "https://syn-forge.com/", title: "Home" }],
    capturedAt: now,
  };
  store.save(evidence);
  assert.deepEqual(store.load(now), evidence);
  assert.equal(store.load(now + PRIOR_EVIDENCE_TTL_MS + 1), null);

  const malformed = createThreadEvidenceStore(
    createSql({
      snapshot: "",
      sources_json: "[]",
      captured_at: now,
    }).sql,
  );
  assert.equal(malformed.load(now), null);

  const badSources = createThreadEvidenceStore(
    createSql({
      snapshot: "evidence",
      sources_json: '{"not":"an array"}',
      captured_at: now,
    }).sql,
  );
  assert.equal(badSources.load(now), null);

  const future = createThreadEvidenceStore(
    createSql({
      snapshot: "evidence",
      sources_json: "[]",
      captured_at: now + 10 * 60 * 1_000,
    }).sql,
  );
  assert.equal(future.load(now), null);
});

test("builds bounded evidence snapshots from usable tool results", () => {
  const evidence = evidenceFromToolResult("tool_X_get_portfolio_overview", overviewResult, 1_000);
  assert.ok(evidence);
  assert.equal(evidence.capturedAt, 1_000);
  assert.deepEqual(evidence.sources, [
    { url: "https://syn-forge.com/", title: "get portfolio overview" },
  ]);
  assert.match(evidence.snapshot, /get_portfolio_overview/);

  assert.equal(
    evidenceFromToolResult("tool_X_get_portfolio_overview", { structuredContent: {} }, 1_000),
    null,
  );

  const oversized = createPortfolioEvidenceSnapshot("get_portfolio_overview", {
    structuredContent: { site: { headerPhrase: "x".repeat(20_000) } },
  });
  assert.ok(oversized);
  assert.ok(oversized.length <= MAX_EVIDENCE_SNAPSHOT_CHARACTERS);
});

test("seeds evidence state from prior sources", () => {
  const state = seedPortfolioEvidenceState([{ url: "https://syn-forge.com/", title: "Home" }]);
  assert.equal(state.successfulResults, 1);
  assert.equal(state.unusableResults, 0);
  assert.deepEqual(state.sources, [{ url: "https://syn-forge.com/", title: "Home" }]);
});

test("prefetches the overview once and tolerates timeout or failure", async () => {
  const calls: string[] = [];
  const success = await prefetchPortfolioOverview({
    tool_X_get_portfolio_overview: tool(async () => {
      calls.push("overview");
      return overviewResult;
    }),
  });
  assert.deepEqual(calls, ["overview"]);
  assert.equal(success?.toolName, "tool_X_get_portfolio_overview");
  assert.deepEqual(success?.result, overviewResult);

  const timeout = await prefetchPortfolioOverview(
    {
      tool_X_get_portfolio_overview: tool(() => new Promise(() => undefined)),
    },
    10,
  );
  assert.equal(timeout, null);

  const failed = await prefetchPortfolioOverview({
    tool_X_get_portfolio_overview: tool(async () => {
      throw new Error("unavailable");
    }),
  });
  assert.equal(failed, null);
  assert.equal(await prefetchPortfolioOverview({}), null);
});
