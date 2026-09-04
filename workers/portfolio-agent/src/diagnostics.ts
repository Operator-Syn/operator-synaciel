const DIAGNOSTIC_PHASES = [
  "agent-start",
  "ws-connect",
  "mcp-startup",
  "mcp-recovery",
  "mcp-rediscovery",
  "mcp-catalog",
  "mcp-tool",
  "quota",
  "model",
  "settlement",
  "thread-title",
] as const;

const DIAGNOSTIC_OUTCOMES = ["started", "succeeded", "failed", "skipped", "rejected"] as const;

const DIAGNOSTIC_REASONS = [
  "no-connection",
  "discovery-failed",
  "unusable-result",
  "timeout",
  "paused",
  "rolling-limit",
  "configuration",
  "provider-error",
  "settlement-failed",
  "aborted",
  "completed",
  "not-required",
  "out-of-scope",
  "missing-identity",
  "missing-question",
  "missing-answer",
  "thread-not-untitled",
  "empty-output",
  "not-updated",
  "database-update",
] as const;

const QUOTA_DECISIONS = [
  "available",
  "paused",
  "rolling-limit",
  "configuration",
  "reserved",
  "settled",
  "settlement-failed",
] as const;

export type PortfolioAgentDiagnosticPhase = (typeof DIAGNOSTIC_PHASES)[number];
export type PortfolioAgentDiagnosticOutcome = (typeof DIAGNOSTIC_OUTCOMES)[number];
export type PortfolioAgentDiagnosticReason = (typeof DIAGNOSTIC_REASONS)[number];
export type PortfolioAgentQuotaDecision = (typeof QUOTA_DECISIONS)[number];

export type PortfolioAgentDiagnostic = {
  phase: PortfolioAgentDiagnosticPhase;
  outcome: PortfolioAgentDiagnosticOutcome;
  attempt?: number;
  elapsedMs?: number;
  toolCount?: number;
  quotaDecision?: PortfolioAgentQuotaDecision;
  reason?: PortfolioAgentDiagnosticReason;
  requestId?: string;
};

export type PortfolioAgentDiagnosticSink = (event: PortfolioAgentDiagnostic) => void;

export type PortfolioAgentDiagnosticContext = {
  sink?: PortfolioAgentDiagnosticSink;
  requestId?: string;
};

function isValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function boundedRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "")
    .slice(0, 96);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Build an allowlisted diagnostic event. Unknown fields, raw messages, and
 * untrusted payloads never pass through this boundary.
 */
export function normalizePortfolioAgentDiagnostic(input: unknown): PortfolioAgentDiagnostic | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (!isValue(DIAGNOSTIC_PHASES, record.phase)) return null;
  if (!isValue(DIAGNOSTIC_OUTCOMES, record.outcome)) return null;

  const event: PortfolioAgentDiagnostic = {
    phase: record.phase,
    outcome: record.outcome,
  };
  const attempt = boundedInteger(record.attempt, 1, 100);
  if (attempt !== undefined) event.attempt = attempt;
  const elapsedMs = boundedInteger(record.elapsedMs, 0, 86_400_000);
  if (elapsedMs !== undefined) event.elapsedMs = elapsedMs;
  const toolCount = boundedInteger(record.toolCount, 0, 1_000);
  if (toolCount !== undefined) event.toolCount = toolCount;
  if (isValue(QUOTA_DECISIONS, record.quotaDecision)) {
    event.quotaDecision = record.quotaDecision;
  }
  if (isValue(DIAGNOSTIC_REASONS, record.reason)) {
    event.reason = record.reason;
  }
  const requestId = boundedRequestId(record.requestId);
  if (requestId) event.requestId = requestId;
  return event;
}

export function defaultPortfolioAgentDiagnosticSink(event: PortfolioAgentDiagnostic): void {
  console.info(`[portfolio-agent:diagnostic] ${JSON.stringify(event)}`);
}

/**
 * Diagnostics must never change the user-visible turn outcome. Sink failures
 * are intentionally swallowed after normalization.
 */
export function emitPortfolioAgentDiagnostic(
  sink: PortfolioAgentDiagnosticSink | undefined,
  input: unknown,
): void {
  const event = normalizePortfolioAgentDiagnostic(input);
  if (!event) return;
  try {
    (sink ?? defaultPortfolioAgentDiagnosticSink)(event);
  } catch {
    // Observability is best effort and must not abort a chat turn.
  }
}
