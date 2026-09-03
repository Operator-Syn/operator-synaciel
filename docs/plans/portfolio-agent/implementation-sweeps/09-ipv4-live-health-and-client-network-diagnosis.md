---
title: Sweep 9 — IPv4 live health and client-network diagnosis
aliases:
  - Portfolio Agent Sweep 9
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

# Sweep 9 — IPv4 live health and client-network diagnosis

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** follow-up reachability checks after the public-auth deployment.

- [x] Public DNS exposes IPv4 Cloudflare edges for `public-auth.syn-forge.com`.
- [x] Both published IPv4 edges return HTTP `200` for `/health` when forced
      with the correct hostname and TLS SNI.
- [x] The agent continues to return HTTP `401` for an unauthenticated request.
- [ ] The default Hiraeth curl path still prefers or reaches an unavailable
      IPv6 path; use `curl -4` or repair the host/ISP IPv6 route before browser
      testing.

The Worker and Custom Domain are reachable over IPv4; no DNS record change is
required based on this check. No credentials or response bodies were captured.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/08-live-protected-boundary-check|Sweep 8 — live protected-boundary check]]
- Next: [[plans/portfolio-agent/implementation-sweeps/10-post-restart-auth-health-confirmation|Sweep 10 — post-restart auth health confirmation]]
