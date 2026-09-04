---
title: Sweep 2 — reconnect and CSRF boundary hardening
aliases:
  - Portfolio Agent Sweep 2
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

# Sweep 2 — reconnect and CSRF boundary hardening

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** one-time agent-token lifecycle in the FAB and state-changing
public-auth requests.

- [x] Disabled the frontend agent-query cache because WebSocket credentials are
      one-use; reconnects request a fresh token.
- [x] Reset the aggregate neuron guard at the UTC day boundary while preserving
      manual pauses, and bound server-side question input to 2,000 characters.
- [x] State-changing public-auth routes fail closed when the Origin header is
      absent or outside the explicit portfolio allowlist.
- [x] Re-ran typecheck, lint, Biome, public-auth tests, frontend tests, and
      the assistant static contract test.

The live browser reconnect path and cross-site request behavior remain
deployment-time checks; no production token or cookie was inspected here.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/01-source-implementation-and-hard-limits|Sweep 1 — source implementation and hard limits]]
- Next: [[plans/portfolio-agent/implementation-sweeps/03-quota-reset-boundary-and-provisioning-documentation-audit|Sweep 3 — quota reset boundary and provisioning-documentation audit]]
