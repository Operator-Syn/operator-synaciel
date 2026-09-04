---
title: Sweep 18 — rolling token budget and readable exhausted threads
aliases:
  - Portfolio Agent Sweep 18
tags:
  - plan
  - agents
  - verification
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-public-assistant
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Sweep 18 — rolling token budget and readable exhausted threads

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-31
**Scope:** per-user model-token allocation, history hydration, compaction
efficiency, and quota documentation.

- [x] Replaced the retired 20-turn UTC-day user gate with a per-Google-subject
      rolling budget of 22,000 estimated model tokens over 30 minutes.
- [x] Added the forward-only `0001_add_rolling_token_usage.sql` migration with
      a subject/time index. The agent reserves the serialized prompt estimate
      plus its 700-token output cap atomically before a model call.
- [x] Removed rolling-budget denial from `POST /agent/token`; owned history
      remains readable even when the next model turn is deferred.
- [x] Added an authenticated history loader independent of the WebSocket token
      gate, including a bounded read-only state when chat access is unavailable.
- [x] Lowered automatic compaction to 16 user turns or 6,000 estimated input
      tokens and stopped sending the same summary twice.
- [x] Added rolling-window, migration, admin-reset, token-route, history, and
      compaction regression coverage.
- [x] Re-ran typecheck, Biome, focused Worker/frontend suites, docs check,
      `git diff --check`, repository mcp-fast/full verification, and Graphify.

The new migration, Worker deployment, and representative Google/Turnstile/
WebSocket verification remain operator-authorized. Apply the migration before
deploying the agent version that writes `rolling_token_usage`.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/17-main-teaser-release-gate-and-agent-development-branch|Sweep 17 — main teaser release gate and agent-development branch]]
- Next: [[plans/portfolio-agent/implementation-sweeps/19-unauthenticated-first-visit-prompt|Sweep 19 — unauthenticated first-visit prompt]]
