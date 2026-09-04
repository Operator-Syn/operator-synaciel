---
title: Sweep 25 — full-thread context mode
aliases:
  - Portfolio Agent Sweep 25
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

# Sweep 25 — full-thread context mode

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-09-01
**Scope:** remove automatic context compaction while preserving the rolling
quota, hard per-turn limits, stream safety, and legacy export compatibility.

- [x] Removed turn/token compaction thresholds and summary injection from agent
      model inputs.
- [x] Removed transient compaction status emission and live panel status copy.
- [x] Kept 200-message Durable Object persistence, the 1,000,000-token/30-minute
      rolling allowance, 10 model passes, 20 MCP calls, and 700-token output cap.
- [x] Kept sanitization and readability for legacy compaction markers already
      present in older thread exports/history.
- [x] Added regression coverage for full-thread model input and legacy marker
      handling.

Full-context mode can reach the provider's context limit; this uses the existing
safe response failure/retry path. Source and local checks are verified; deployment
and authenticated browser replay remain operator-authorized.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/24-contact-link-grounding-and-same-thread-continuity|Sweep 24 — contact-link grounding and same-thread continuity]]
- Next: [[plans/portfolio-agent/implementation-sweeps/26-remove-application-request-caps|Sweep 26 — remove application request caps]]
