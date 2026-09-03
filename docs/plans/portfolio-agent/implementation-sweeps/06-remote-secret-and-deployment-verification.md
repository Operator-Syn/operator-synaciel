---
title: Sweep 6 — remote secret and deployment verification
aliases:
  - Portfolio Agent Sweep 6
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

# Sweep 6 — remote secret and deployment verification

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** remote Worker secret-name presence, D1 state, deployment history,
and public endpoint reachability.

- [x] The agent has `AGENT_INTERNAL_KEY` and `AGENT_TOKEN_PUBLIC_JWK` secret
      names configured.
- [x] Public-auth has `AGENT_INTERNAL_KEY`, `AGENT_TOKEN_PRIVATE_JWK`,
      `GOOGLE_CLIENT_SECRET`, and `TURNSTILE_SECRET_KEY` configured.
- [x] The remote auth D1 migration list reports no pending migrations.
- [x] Recent portfolio-agent and public-auth deployments are present.
- [x] Existing API and public MCP smoke requests returned HTTP 200.
- [ ] `public-auth.syn-forge.com` and `assistant.syn-forge.com` still need
      active Custom Domains/DNS; current requests fail with DNS resolution
      errors before reaching either Worker.

Secret values and JWK pairing cannot be inspected through Wrangler listings.
After the Custom Domains are active, repeat the auth health, protected-agent,
Google sign-in, Turnstile, chat, export, and delete smoke checks.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/05-auth-d1-database-provisioning|Sweep 5 — auth D1 database provisioning]]
- Next: [[plans/portfolio-agent/implementation-sweeps/07-wrangler-custom-domain-declaration|Sweep 7 — Wrangler Custom Domain declaration]]
