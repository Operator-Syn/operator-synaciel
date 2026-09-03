---
title: Portfolio Agent Deferred Reliability Work
aliases:
  - Portfolio assistant deferred work
tags:
  - plan
  - agents
  - mcp
role: project-plan-deferred
status: deferred
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: medium
---

# Portfolio Agent Deferred Reliability Work

This note keeps follow-up ideas out of the active sweep files. Return to
[[plans/portfolio-agent/README|the reliability plan]] or
[[plans/portfolio-agent/audit|the audit]], or the [[plans/portfolio-agent/implementation-sweeps/README|implementation sweep index]] when a new sweep is authorized.

## Deferred items

- **Soft wall-clock or tool-call circuit breakers:** consider only after
  telemetry shows the intentionally uncapped model loop causes harmful latency
  or upstream load. Preserve the provider's own context and output limits.
- **Two-phase quota reservation:** consider if rejected turns still consume
  meaningful MCP work. It would need provisional reservation, release, and
  settlement semantics without stranding capacity.
- **User-controlled context management:** consider explicit user actions only if
  full-thread context reaches provider limits. Do not silently reintroduce
  automatic compaction.
- **MCP outage cooldown:** consider after structured failure-rate evidence exists.
  A circuit breaker would need durable state, expiry, and a safe recovery path.
- **Authenticated live replay:** run the operator-owned Google, Turnstile,
  session, WebSocket, rendered-text, and reconnect checks after deployment and
  migration approval.

Each item stays deferred until its evidence threshold and scope are reviewed;
none is implied by local source verification.
