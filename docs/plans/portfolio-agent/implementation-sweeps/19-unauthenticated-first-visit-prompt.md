---
title: Sweep 19 — unauthenticated first-visit prompt
aliases:
  - Portfolio Agent Sweep 19
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

# Sweep 19 — unauthenticated first-visit prompt

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-31
**Scope:** incognito/first-visit session discovery in the assistant FAB.

- [x] Kept the public-auth contract of `GET /session` returning
      `401 { authenticated: false }` when no valid session cookie is present.
- [x] Normalized that expected response in the frontend API to the ordinary
      signed-out state so incognito visitors see the Google sign-in prompt.
- [x] Preserved coded `401` responses as real service/auth failures.
- [x] Added regression coverage for both the missing-cookie and coded-failure
      paths.

The change is source-verified only; browser incognito and deployed cookie
behavior still require an operator-owned live smoke check.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/18-rolling-token-budget-and-readable-exhausted-threads|Sweep 18 — rolling token budget and readable exhausted threads]]
- Next: [[plans/portfolio-agent/implementation-sweeps/20-explicit-capacity-pause-diagnostics|Sweep 20 — explicit capacity-pause diagnostics]]
