---
title: Sweep 8 — live protected-boundary check
aliases:
  - Portfolio Agent Sweep 8
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

# Sweep 8 — live protected-boundary check

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** first live endpoint checks after the Worker secret deployments.

- [x] `assistant.syn-forge.com` resolves and rejects an unauthenticated agent
      request with HTTP `401`, confirming the protected boundary is live.
- [ ] `public-auth.syn-forge.com` still fails DNS resolution; deploy the
      updated public-auth Wrangler configuration before retrying auth checks.

No cookies, access tokens, or private response bodies were captured.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/07-wrangler-custom-domain-declaration|Sweep 7 — Wrangler Custom Domain declaration]]
- Next: [[plans/portfolio-agent/implementation-sweeps/09-ipv4-live-health-and-client-network-diagnosis|Sweep 9 — IPv4 live health and client-network diagnosis]]
