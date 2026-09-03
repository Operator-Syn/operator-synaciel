---
title: Sweep 33 — Structured diagnostics
aliases:
  - Portfolio Agent Sweep 33
tags:
  - plan
  - agents
  - mcp
  - observability
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Sweep 33 — Structured diagnostics

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]],
[[plans/portfolio-agent/README|the reliability plan]], or
[[plans/portfolio-agent/audit|the audit]]. The completed timing work is in
[[plans/portfolio-agent/sweeps/32-shared-mcp-discovery-deadline|Sweep 32]].

## Objective

Make the server-side lifecycle explain what happened without creating
user-visible source activity or leaking sensitive content. The event stream
must distinguish a static/rejected turn, MCP discovery or grounding failure,
provider stream failure, and completed text settlement.

## Design contract

- Use a typed event sink with a small phase/outcome vocabulary for MCP startup,
  rediscovery, preflight, quota admission, model execution, and settlement.
- Include only redacted metadata: phase, outcome, attempt, elapsed milliseconds,
  catalog/tool counts, quota decision class, and an opaque request correlation
  value.
- Reject or omit question text, raw MCP payloads and tool arguments, provider
  responses, credentials, stack traces, and arbitrary error messages.
- Keep existing user-facing responses and the no-ghosting rule unchanged:
  static or quota-rejected turns do not show fake MCP activity.
- Test event ordering and redaction on success, quota rejection, discovery
  failure, provider failure, and settlement failure paths.

## Implementation and evidence

- [x] Added a dedicated diagnostics module with allowlisted phase/outcome,
  bounded attempt/elapsed/tool-count metadata, quota decision classes, and
  sanitized request correlation values.
- [x] Instrumented MCP startup/recovery/rediscovery, preflight/grounding,
  quota availability/reservation, model start/end/error, and usage settlement.
  Diagnostics are server-side only; static and quota-rejected turns do not emit
  MCP activity.
- [x] Sink failures are swallowed and existing user-facing responses, stream
  coalescing, and no-ghosting behavior are unchanged.
- [x] Added redaction, lifecycle-order, failure-path, and agent integration
  regression coverage. The portfolio-agent suite passes 40 tests; its
  typecheck and Biome check pass.

No migration, deployment, or authenticated live replay was run. Local evidence
does not establish deployed rendering or provider behavior.

## Acceptance gate

The fixed repository verification profile passed after the focused checks:
repository MCP, public MCP, API, web, migrations, root typecheck/lint/Biome, and
build. Live authenticated replay remains a separate boundary.

Deferred alternatives and their entry criteria are listed in
[[plans/portfolio-agent/deferred|Deferred work]].
