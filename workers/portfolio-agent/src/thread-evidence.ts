import {
  createPortfolioEvidenceSnapshot,
  extractPortfolioSources,
  hasUsablePortfolioToolResult,
  type PortfolioSource,
  parseStoredPortfolioEvidence,
  type StoredPortfolioEvidence,
} from "./evidence.ts";
import type { McpTool } from "./limits.ts";

export const PREFETCH_TIMEOUT_MS = 10_000;

export type EvidenceSql = (
  query: string[],
  ...values: Array<string | number>
) => Array<Record<string, unknown>>;

export function ensureThreadEvidenceSchema(sql: EvidenceSql): void {
  sql([
    "CREATE TABLE IF NOT EXISTS portfolio_agent_evidence (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL, sources_json TEXT NOT NULL, captured_at INTEGER NOT NULL)",
  ]);
}

export function createThreadEvidenceStore(sql: EvidenceSql) {
  return {
    load(now: number): StoredPortfolioEvidence | null {
      const row = sql([
        "SELECT snapshot, sources_json, captured_at FROM portfolio_agent_evidence WHERE id = 1 LIMIT 1",
      ])[0];
      return parseStoredPortfolioEvidence(row, now);
    },
    save(evidence: StoredPortfolioEvidence): void {
      sql(
        [
          "INSERT INTO portfolio_agent_evidence (id, snapshot, sources_json, captured_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, sources_json = excluded.sources_json, captured_at = excluded.captured_at",
        ],
        evidence.snapshot,
        JSON.stringify(evidence.sources),
        evidence.capturedAt,
      );
    },
  };
}

export function evidenceFromToolResult(
  toolName: string,
  value: unknown,
  capturedAt: number,
  sources?: readonly PortfolioSource[],
): StoredPortfolioEvidence | null {
  if (!hasUsablePortfolioToolResult(toolName, value)) return null;
  const snapshot = createPortfolioEvidenceSnapshot(toolName, value);
  if (!snapshot) return null;
  return {
    snapshot,
    sources: sources ? [...sources] : extractPortfolioSources(toolName, value),
    capturedAt,
  };
}

export async function prefetchPortfolioOverview(
  tools: Record<string, McpTool>,
  timeoutMs = PREFETCH_TIMEOUT_MS,
): Promise<{ toolName: string; result: unknown } | null> {
  const entry = Object.entries(tools).find(
    ([name]) => name === "get_portfolio_overview" || name.endsWith("_get_portfolio_overview"),
  );
  if (!entry) return null;

  const [toolName, tool] = entry;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve().then(() =>
        tool.execute({}, { toolCallId: "prefetch-portfolio-overview", messages: [] }),
      ),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (result === null || !hasUsablePortfolioToolResult(toolName, result)) return null;
    return { toolName, result };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
