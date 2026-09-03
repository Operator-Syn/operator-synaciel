---
title: Sweep 32 — Shared MCP discovery deadline
aliases:
  - Portfolio Agent Sweep 32
tags:
  - plan
  - agents
  - mcp
  - timing
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-02
risk: high
---

# Sweep 32 — Shared MCP discovery deadline

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]],
[[plans/portfolio-agent/README|the reliability plan]], or
[[plans/portfolio-agent/audit|the audit]]. The preceding catalog behavior is
in [[plans/portfolio-agent/sweeps/31-non-destructive-mcp-rediscovery|Sweep 31]].

## Objective

Bound the preflight discovery phase to one maximum
MCP_DISCOVERY_TIMEOUT_MS budget while allowing an immediately settled
connection to advance without an artificial delay.

## Implementation

- waitForMcpConnections is disabled on AIChatAgent; preflight owns the single
  mcp.waitForConnections({ timeout: 60_000 }) call.
- Preflight records a deadline once and computes remaining milliseconds before
  direct catalog rediscovery.
- Direct rediscovery receives only the remaining budget. A successful refresh
  avoids remove/re-add; a failed refresh passes the same absolute deadline to
  the existing recovery helper, which checks the budget before cleanup, each
  add attempt, and retry backoff.
- The available catalog is read after the bounded phase and the existing
  evidence-unavailable response remains the fail-closed result when
  search_portfolio is still unavailable.

## Evidence and gate

The source-level ordering test asserts one wait call before getAITools(), the
60-second constant, the remaining-time helper, the recovery seam, and the
shared deadline handoff. Deterministic lifecycle tests cover settled, failed,
and deadline arithmetic without sleeping for 60 seconds. Portfolio-agent
tests, typecheck, Biome, and the fixed repository verification profile passed
locally.

The deadline bounds the discovery wait, in-place refresh budget, and any
remove/re-add recovery work that can still begin in the remaining window. The
SDK does not expose cancellation for `addMcpServer`; an already-started SDK
operation is awaited, but no cleanup, retry, or late success can extend
preflight into a new recovery attempt. A future diagnostics sweep can make the
exact phase durations visible. Deployment, migration application, and
authenticated browser replay remain separate operator-owned checks.

Continue to [[plans/portfolio-agent/sweeps/33-structured-diagnostics|Sweep 33 —
structured diagnostics]].
