import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emitPortfolioAgentDiagnostic,
  normalizePortfolioAgentDiagnostic,
  type PortfolioAgentDiagnostic,
} from "../../workers/portfolio-agent/src/diagnostics.ts";

test("emits only bounded diagnostic fields and redacts untrusted metadata", () => {
  const events: PortfolioAgentDiagnostic[] = [];

  emitPortfolioAgentDiagnostic(events.push.bind(events), {
    phase: "mcp-catalog",
    outcome: "failed",
    attempt: 2,
    elapsedMs: 12.6,
    toolCount: 3,
    quotaDecision: "available",
    reason: "timeout",
    requestId: "req_42",
    question: "private question text",
    rawMcpPayload: { secret: "private payload" },
  } as never);

  assert.deepEqual(events, [
    {
      phase: "mcp-catalog",
      outcome: "failed",
      attempt: 2,
      elapsedMs: 13,
      toolCount: 3,
      quotaDecision: "available",
      reason: "timeout",
      requestId: "req_42",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /private question|private payload|secret/);
});

test("drops invalid diagnostic values and clamps numeric metadata", () => {
  const normalized = normalizePortfolioAgentDiagnostic({
    phase: "model",
    outcome: "succeeded",
    attempt: -4,
    elapsedMs: Number.POSITIVE_INFINITY,
    toolCount: 9_999,
    requestId: " req/42 with spaces ",
    reason: "completed",
  });

  assert.deepEqual(normalized, {
    phase: "model",
    outcome: "succeeded",
    attempt: 1,
    toolCount: 1_000,
    requestId: "req42withspaces",
    reason: "completed",
  });
  assert.equal(
    normalizePortfolioAgentDiagnostic({
      phase: "not-a-phase",
      outcome: "started",
    } as never),
    null,
  );
});

test("diagnostic sink failures never affect the caller", () => {
  assert.doesNotThrow(() => {
    emitPortfolioAgentDiagnostic(
      () => {
        throw new Error("sink failed");
      },
      { phase: "quota", outcome: "rejected", reason: "rolling-limit" },
    );
  });
});
