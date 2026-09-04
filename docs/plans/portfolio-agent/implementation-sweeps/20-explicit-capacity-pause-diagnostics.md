---
title: Sweep 20 — explicit capacity-pause diagnostics
aliases:
  - Portfolio Agent Sweep 20
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

# Sweep 20 — explicit capacity-pause diagnostics

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-31
**Scope:** distinguish account-wide Workers AI safety pauses from per-user
rolling-budget exhaustion in token and in-thread responses.

- [x] `AGENT_PAUSED` now explains that shared capacity is paused because the
      account-wide safety budget is full or an administrator paused it.
- [x] The frontend renders `Shared capacity paused` instead of the generic
      `Assistant unavailable` state.
- [x] The in-thread response names the account-wide daily safety budget and
      confirms that the 22,000-token rolling user allowance is separate.
- [x] Added regression assertions across frontend, public-auth, and agent
      boundaries.

Live control-row state and production deployment remain separate from this
source verification.

Sweep 20's account-wide estimate wording is superseded by Sweep 21: provider
usage is authoritative, and only an administrator pause is admitted through
the control row.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/19-unauthenticated-first-visit-prompt|Sweep 19 — unauthenticated first-visit prompt]]
- Superseded by: [[plans/portfolio-agent/implementation-sweeps/21-provider-authoritative-capacity-messaging|Sweep 21 — provider-authoritative capacity messaging]]
