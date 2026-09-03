---
title: Sweep 28 — settle rolling quota on actual model usage
aliases:
  - Portfolio Agent Sweep 28
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

# Sweep 28 — settle rolling quota on actual model usage

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-09-01
**Scope:** replace estimate-only rolling accounting with provider-reported
aggregate input plus output usage after each completed model stream.

- [x] Added the forward-only
      `workers/portfolio-public-auth/migrations/0002_add_actual_token_usage.sql`
      migration with nullable input/output columns; existing reservations remain
      compatible through the `estimated_tokens` fallback.
- [x] Kept the pre-call serialized-prompt estimate as a provisional admission
      reservation so concurrent turns still have a bounded gate.
- [x] Settled completed `streamText` turns from the AI SDK's aggregate
      `usage.inputTokens + usage.outputTokens`; cache-read/write detail fields
      are intentionally ignored.
- [x] Updated the public quota endpoint and rolling-budget UI to report settled
      token totals, with a safe provisional fallback for interrupted or
      incomplete streams.
- [x] Added quota, migration, agent-source, public-auth, and UI regression
      coverage.

The migration must be applied before deploying this runtime version. Source and
local checks establish the implementation only; migration application, Worker
deployment, and authenticated browser replay remain separately authorized live
checks.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/27-eager-mcp-tool-discovery-before-preflight|Sweep 27 — eager MCP tool discovery before preflight]]
- Next: [[plans/portfolio-agent/implementation-sweeps/29-bounded-mcp-recovery-and-quota-admission-before-grounding|Sweep 29 — bounded MCP recovery and quota admission before grounding]]
