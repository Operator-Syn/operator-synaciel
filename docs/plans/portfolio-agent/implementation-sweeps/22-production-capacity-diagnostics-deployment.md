---
title: Sweep 22 — production capacity-diagnostics deployment
aliases:
  - Portfolio Agent Sweep 22
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

# Sweep 22 — production capacity-diagnostics deployment

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-31

**Scope:** deploy the provider-authoritative capacity fix and verify the public
boundaries without using an authenticated browser session.

- [x] Agent dry run and production deployment passed. The deployed version is
      `9f277744-5c66-40b4-8bec-1fce04db24bd`.
- [x] Public-auth dry run and production deployment passed. The deployed
      version is `578fbaf4-3720-4166-a328-bacacc7d73a3`.
- [x] `https://public-auth.syn-forge.com/health` returned HTTP `200`.
- [x] A localhost CORS preflight returned `204` with the exact
      `http://localhost:5173` origin and credentials enabled; an untrusted
      origin did not receive an allow-origin header.
- [x] The deployed agent returned HTTP `401` without a token, while the
      public-auth session endpoint returned the expected unauthenticated state.
- [ ] Complete the operator-owned Google OAuth, Turnstile, session-cookie, and
      authenticated WebSocket smoke flow. The first successful token request
      will clear the legacy `daily-neuron-budget` control marker.

No credentials, cookies, access tokens, or transcript contents were captured.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/21-provider-authoritative-capacity-messaging|Sweep 21 — provider-authoritative capacity messaging]]
- Next: [[plans/portfolio-agent/implementation-sweeps/23-expanded-rolling-allowance-with-independent-hard-limits|Sweep 23 — expanded rolling allowance with independent hard limits]]
