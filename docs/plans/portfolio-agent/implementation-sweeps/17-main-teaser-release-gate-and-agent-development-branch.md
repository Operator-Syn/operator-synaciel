---
title: Sweep 17 — main teaser release gate and agent-development branch
aliases:
  - Portfolio Agent Sweep 17
tags:
  - plan
  - agents
  - verification
role: project-plan-sweep
status: in_progress
plan_id: portfolio-agent-public-assistant
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Sweep 17 — main teaser release gate and agent-development branch

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-30
**Scope:** public assistant release posture, branch separation, and production
deployment safety.

- [x] Added an explicit `teaser` availability gate to the main-branch FAB. The
      coming-soon panel is still accessible across the site but returns before
      session, Turnstile, or agent-token requests.
- [x] Kept the authenticated chat implementation and its Suspense/error-boundary
      fix intact behind the same gate for development work.
- [x] Reserved `agent-development` as the only branch that switches the gate to
      `active`; it is not a production deployment target.
- [x] Updated the architecture, local-development, and deployment notes with
      the main-versus-development surface boundary.
- [ ] Keep the active branch out of the production Pages branch until the next
      agent review, live smoke flow, and release decision are complete.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/16-async-agent-connection-render-guard|Sweep 16 — async agent connection render guard]]
- Next: [[plans/portfolio-agent/implementation-sweeps/18-rolling-token-budget-and-readable-exhausted-threads|Sweep 18 — rolling token budget and readable exhausted threads]]
