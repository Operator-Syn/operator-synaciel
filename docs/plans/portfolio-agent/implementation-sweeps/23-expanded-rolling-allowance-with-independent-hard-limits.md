---
title: Sweep 23 — expanded rolling allowance with independent hard limits
aliases:
  - Portfolio Agent Sweep 23
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

# Sweep 23 — expanded rolling allowance with independent hard limits

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-31

**Scope:** raise the per-subject rolling reservation from 22,000 to 1,000,000
estimated tokens without widening a model request or any tool/concurrency cap.

- [x] Set the effective `ROLLING_TOKEN_BUDGET` to `1_000_000` in both Worker
      configuration modules. The window remains 30 minutes and reservations
      remain account-wide across a subject's threads.
- [x] Kept the model context bounded by the existing 16-user-turn /
      6,000-estimated-input-token compaction thresholds and the 700-token output
      cap. A 1,000,000-token allowance never becomes a single model prompt.
- [x] Kept the per-turn ceilings unchanged: 10 model passes and 20 MCP calls,
      including preflight search.
- [x] Removed the redundant thread burst ceiling; the rolling subject budget
      is now the user-facing usage allocation.
- [x] Updated quota tests, Worker security assertions, current architecture,
      local-development, and deployment notes.

Cloudflare's Workers AI daily allocation and provider capacity remain separate;
the larger application allowance does not bypass the provider's daily neuron
limit. Deployment of this configuration is a separate authorized operation.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/22-production-capacity-diagnostics-deployment|Sweep 22 — production capacity-diagnostics deployment]]
- Next: [[plans/portfolio-agent/implementation-sweeps/24-contact-link-grounding-and-same-thread-continuity|Sweep 24 — contact-link grounding and same-thread continuity]]
