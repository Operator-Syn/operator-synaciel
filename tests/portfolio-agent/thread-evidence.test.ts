import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPortfolioEvidenceLedger,
  MAX_EVIDENCE_ENTRIES,
  MAX_EVIDENCE_ENTRY_CHARACTERS,
  MAX_EVIDENCE_LEDGER_CHARACTERS,
  PRIOR_EVIDENCE_TTL_MS,
  type StoredPortfolioEvidence,
} from "../../workers/portfolio-agent/src/evidence.ts";
import type { McpTool } from "../../workers/portfolio-agent/src/limits.ts";
import {
  createThreadEvidenceStore,
  type EvidenceSql,
  ensureThreadEvidenceSchema,
  evidenceFromToolResult,
  prefetchPortfolioOverview,
} from "../../workers/portfolio-agent/src/thread-evidence.ts";

function createSql(initialRows: Record<string, unknown>[] = []) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const row of initialRows) rows.set(String(row.slot), row);
  const queries: string[] = [];
  const sql: EvidenceSql = (query, ...values) => {
    const text = query.join("?");
    queries.push(text);
    if (text.startsWith("CREATE TABLE")) return [];
    if (text.startsWith("SELECT")) {
      return [...rows.values()].sort(
        (left, right) => Number(right.captured_at) - Number(left.captured_at),
      );
    }
    if (text.startsWith("INSERT INTO")) {
      const [slot, tool_name, snapshot, sources_json, captured_at] = values;
      rows.set(String(slot), { slot, tool_name, snapshot, sources_json, captured_at });
      return [];
    }
    if (text.startsWith("DELETE FROM portfolio_agent_evidence_ledger WHERE slot")) {
      rows.delete(String(values[0]));
      return [];
    }
    if (text.startsWith("DELETE FROM portfolio_agent_evidence_ledger")) {
      rows.clear();
      return [];
    }
    throw new Error(`Unexpected SQL: ${text}`);
  };
  return { sql, queries, rows };
}

function tool(execute: McpTool["execute"]): McpTool {
  return { inputSchema: {}, execute };
}

const overviewResult = {
  structuredContent: {
    site: { headerPhrase: "Build with intent" },
    profile: [{ label: "Role", value: "Software developer" }],
    sections: [
      {
        id: 1,
        title: "Selected work",
        section_type: "work",
        items: [
          { label: "Project", content: "A verified project", image_url: null, target_url: null },
        ],
      },
    ],
  },
};

function pageResult(path: string, content: string) {
  return {
    structuredContent: {
      path,
      page_url: `https://syn-forge.com${path}`,
      title: `Page ${path}`,
      content,
      offset: 0,
      next_offset: content.length,
      total_characters: content.length,
      complete: true,
    },
  };
}

test("creates the keyed evidence ledger without replacing the legacy table", () => {
  const fixture = createSql();
  ensureThreadEvidenceSchema(fixture.sql);

  const schema = fixture.queries[0] ?? "";
  assert.match(schema, /portfolio_agent_evidence_ledger/);
  assert.match(schema, /slot TEXT PRIMARY KEY/);
  assert.match(schema, /tool_name TEXT NOT NULL/);
  assert.doesNotMatch(schema, /DROP TABLE/);
});

test("keeps overview and page evidence together while upserting each slot", () => {
  const now = 1_000_000;
  const fixture = createSql();
  const store = createThreadEvidenceStore(fixture.sql);
  const overview = evidenceFromToolResult("tool_X_get_portfolio_overview", overviewResult, now);
  const page = evidenceFromToolResult(
    "read_portfolio_page",
    pageResult("/ai", "MCP details"),
    now + 1,
  );
  assert.ok(overview);
  assert.ok(page);

  store.save(overview);
  store.save(page);
  assert.deepEqual(
    store.load(now + 2).map((entry) => entry.slot),
    ["overview", "page:/ai"],
  );
  assert.deepEqual(page.sources, [{ url: "https://syn-forge.com/ai", title: "Page /ai" }]);

  const updatedPage = evidenceFromToolResult(
    "read_portfolio_page",
    pageResult("/ai", "Updated MCP details"),
    now + 3,
  );
  assert.ok(updatedPage);
  store.save(updatedPage);
  const loaded = store.load(now + 4);
  assert.equal(loaded.length, 2);
  assert.match(loaded[1]?.snapshot ?? "", /Updated MCP details/);
  assert.equal(loaded[0]?.slot, "overview");
});

test("drops expired, malformed, and invalid-source rows during pruning", () => {
  const now = 1_000_000;
  const malformed = createSql([
    {
      slot: "overview",
      tool_name: "get_portfolio_overview",
      snapshot: "not-json",
      sources_json: "[]",
      captured_at: now,
    },
    {
      slot: "page:/bad",
      tool_name: "read_portfolio_page",
      snapshot: JSON.stringify({
        slot: "page:/bad",
        tool: "read_portfolio_page",
        evidence: { content: "text" },
      }),
      sources_json: "{",
      captured_at: now,
    },
  ]);
  const malformedStore = createThreadEvidenceStore(malformed.sql);
  assert.deepEqual(malformedStore.load(now), []);
  malformedStore.prune(now);
  assert.equal(malformed.rows.size, 0);

  const expiredFixture = createSql();
  const expiredStore = createThreadEvidenceStore(expiredFixture.sql);
  const overview = evidenceFromToolResult("get_portfolio_overview", overviewResult, now);
  assert.ok(overview);
  expiredStore.save(overview);
  assert.deepEqual(expiredStore.load(now + PRIOR_EVIDENCE_TTL_MS + 1), []);
  expiredStore.prune(now + PRIOR_EVIDENCE_TTL_MS + 1);
  assert.equal(expiredFixture.rows.size, 0);
});

test("bounds entries while pinning the newest overview", () => {
  const now = 2_000_000;
  const fixture = createSql();
  const store = createThreadEvidenceStore(fixture.sql);
  const overview = evidenceFromToolResult("get_portfolio_overview", overviewResult, now);
  assert.ok(overview);
  store.save(overview);

  for (let index = 0; index < MAX_EVIDENCE_ENTRIES + 1; index += 1) {
    const entry = evidenceFromToolResult(
      "read_portfolio_page",
      pageResult(`/page-${String(index)}`, `Page ${String(index)}`),
      now + index + 1,
    );
    assert.ok(entry);
    store.save(entry);
  }

  const loaded = store.load(now + MAX_EVIDENCE_ENTRIES + 2);
  assert.equal(loaded.length, MAX_EVIDENCE_ENTRIES);
  assert.equal(loaded[0]?.slot, "overview");
  assert.equal(
    loaded.some((entry) => entry.slot === "page:/page-0"),
    false,
  );
  assert.equal(
    loaded.some((entry) => entry.slot === "page:/page-1"),
    false,
  );
  assert.equal(loaded.at(-1)?.slot, "page:/page-2");
});

test("keeps large page content bounded and valid JSON", () => {
  const now = 3_000_000;
  const page = evidenceFromToolResult(
    "read_portfolio_page",
    pageResult("/long", "x".repeat(32_000)),
    now,
  );
  assert.ok(page);
  assert.ok(page.snapshot.length <= MAX_EVIDENCE_ENTRY_CHARACTERS);
  const parsed = JSON.parse(page.snapshot) as {
    evidence: { content: string; content_truncated: boolean };
  };
  assert.equal(parsed.evidence.content.length, 11_000);
  assert.equal(parsed.evidence.content_truncated, true);
});

test("keeps the rendered ledger within its combined context budget", () => {
  const now = 4_000_000;
  const entries: StoredPortfolioEvidence[] = [];
  const overview = evidenceFromToolResult("get_portfolio_overview", overviewResult, now);
  assert.ok(overview);
  entries.push(overview);
  for (let index = 0; index < 3; index += 1) {
    const entry = evidenceFromToolResult(
      "read_portfolio_page",
      pageResult(`/large-${String(index)}`, "y".repeat(32_000)),
      now + index + 1,
    );
    assert.ok(entry);
    entries.push(entry);
  }

  const ledger = formatPortfolioEvidenceLedger(entries, now + 10);
  assert.ok(ledger.length <= MAX_EVIDENCE_LEDGER_CHARACTERS);
  assert.match(ledger, /ENTRY overview/);
  assert.match(ledger, /ENTRY page:\/large-2/);
  assert.doesNotMatch(ledger, /ENTRY page:\/large-0/);
  assert.match(ledger, /untrusted data/i);
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
