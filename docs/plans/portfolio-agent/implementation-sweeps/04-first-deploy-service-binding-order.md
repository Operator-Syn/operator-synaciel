---
title: Sweep 4 — first-deploy service-binding order
aliases:
  - Portfolio Agent Sweep 4
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

# Sweep 4 — first-deploy service-binding order

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** GitHub Actions dependency graph and production runbook ordering.

- [x] The workflow now deploys `portfolio-agent` before `public-auth`, whose
      `AGENT_WORKER` Service Binding targets the agent Worker.
- [x] Deployment-path assertions cover the corrected `MCP -> agent ->
      public-auth` dependency chain.
- [x] The runbook explains why Pages remains independent while the Worker graph
      is dependency-ordered.

Cloudflare provisioning, deployment execution, and live verification remain
operator-authorized external steps.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/03-quota-reset-boundary-and-provisioning-documentation-audit|Sweep 3 — quota reset boundary and provisioning-documentation audit]]
- Next: [[plans/portfolio-agent/implementation-sweeps/05-auth-d1-database-provisioning|Sweep 5 — auth D1 database provisioning]]
