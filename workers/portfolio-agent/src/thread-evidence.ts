import {
  boundPortfolioEvidenceLedger,
  createPortfolioEvidenceEntry,
  hasUsablePortfolioToolResult,
  type PortfolioEvidenceLedger,
  parseStoredPortfolioEvidence,
  type StoredPortfolioEvidence,
} from "./evidence.ts";
import type { McpTool } from "./limits.ts";

export const PREFETCH_TIMEOUT_MS = 10_000;

const EVIDENCE_TABLE = "portfolio_agent_evidence_ledger";
const EVIDENCE_COLUMNS = "slot, tool_name, snapshot, sources_json, captured_at";

export type EvidenceSql = (
  query: string[],
  ...values: Array<string | number>
) => Array<Record<string, unknown>>;

export function ensureThreadEvidenceSchema(sql: EvidenceSql): void {
  sql([
    `CREATE TABLE IF NOT EXISTS ${EVIDENCE_TABLE} (slot TEXT PRIMARY KEY, tool_name TEXT NOT NULL, snapshot TEXT NOT NULL, sources_json TEXT NOT NULL, captured_at INTEGER NOT NULL)`,
  ]);
}

function rawRows(sql: EvidenceSql): Array<Record<string, unknown>> {
  return sql([`SELECT ${EVIDENCE_COLUMNS} FROM ${EVIDENCE_TABLE} ORDER BY captured_at DESC`]);
}

function deleteSlot(sql: EvidenceSql, slot: string): void {
  sql([`DELETE FROM ${EVIDENCE_TABLE} WHERE slot = ?`], slot);
}

export function createThreadEvidenceStore(sql: EvidenceSql) {
  const store = {
    /** Load fresh valid entries in prompt-ready order. */
    load(now: number): PortfolioEvidenceLedger {
      const parsed = rawRows(sql)
        .map((row) => parseStoredPortfolioEvidence(row, now))
        .filter((entry): entry is StoredPortfolioEvidence => entry !== null);
      return boundPortfolioEvidenceLedger(parsed, now);
    },

    /** Upsert one evidence slot and immediately enforce count and age bounds. */
    save(evidence: StoredPortfolioEvidence): void {
      sql(
        [
          `INSERT INTO ${EVIDENCE_TABLE} (${EVIDENCE_COLUMNS}) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slot) DO UPDATE SET tool_name = excluded.tool_name, snapshot = excluded.snapshot, sources_json = excluded.sources_json, captured_at = excluded.captured_at`,
        ],
        evidence.slot,
        evidence.toolName,
        evidence.snapshot,
        JSON.stringify(evidence.sources),
        evidence.capturedAt,
      );
      store.prune(evidence.capturedAt);
    },

    /** Remove malformed, expired, duplicate, and over-capacity rows. */
    prune(now: number): void {
      const parsedBySlot = new Map<string, StoredPortfolioEvidence>();
      for (const row of rawRows(sql)) {
        const parsed = parseStoredPortfolioEvidence(row, now);
        if (parsed) parsedBySlot.set(parsed.slot, parsed);
      }
      const kept = new Set(
        boundPortfolioEvidenceLedger([...parsedBySlot.values()], now).map((entry) => entry.slot),
      );
      const knownRows = rawRows(sql);
      for (const row of knownRows) {
        const slot = typeof row.slot === "string" ? row.slot : "";
        if (!slot || !kept.has(slot)) {
          if (slot) deleteSlot(sql, slot);
        }
      }
    },
  };
  return store;
}

export function evidenceFromToolResult(
  toolName: string,
  value: unknown,
  capturedAt: number,
): StoredPortfolioEvidence | null {
  return createPortfolioEvidenceEntry(toolName, value, capturedAt);
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
