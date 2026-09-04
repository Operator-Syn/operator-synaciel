---
title: Sweep 1 — source implementation and hard limits
aliases:
  - Portfolio Agent Sweep 1
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

# Sweep 1 — source implementation and hard limits

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** public-auth Worker, agent Worker, global FAB chat surface, deployment
graph, tests, and canonical notes.

- [x] Google OIDC authorization-code + PKCE, state, nonce, fixed callback, and
      verified-email validation.
- [x] Host-only session cookie, hashed session IDs, one-time five-minute
      scoped agent tokens, ES256 verification, and WebSocket path binding.
- [x] D1 schema for users, sessions, threads, rolling token reservations, and
      admin control; no automatic migration application.
- [x] Portfolio MCP `search_portfolio` preflight and fail-closed evidence gate.
- [x] **10 model passes** and **20 MCP calls including preflight**; regression
      test covers budget exhaustion.
- [x] GitHub tools require explicit repository context; unsafe requests receive
      a bounded refusal.
- [x] Durable thread persistence, compaction notice, sanitized export, delete,
      30-day retention cleanup, rolling token quota, aggregate neuron pause, and
      admin reset/control routes.
- [x] Site-wide FAB UI with Google sign-in, Turnstile gate, thread list/new/
      export/delete, durable reconnect status, and reduced-motion styling.
- [x] Workflow graph: validate -> portfolio-api -> (MCP + public-auth) ->
      portfolio-agent. Pages remains Git-integrated and independent.
- [x] Regression tests cover hard limits, auth validation, assistant mounting,
      and deployment paths.

### Evidence recorded for this sweep

- `npm ci`
- `npm run typecheck`
- `npm run check:biome:github`
- `npm run public-auth:check`
- `npm run portfolio-agent:check`
- `npm run test:public-auth`
- `npm run test:portfolio-agent`
- targeted frontend and deployment-path tests
- frontend, API, MCP, public-auth, and portfolio-agent test suites passed
- `npm run docs:check`, `npm run mcp:check`, and `npm run mcp:portfolio:check` passed
- full repository verification profile passed
- `pipenv run graphify update . --no-cluster` completed

### Remaining approval-gated work

- [ ] Create the separate auth D1 database and apply the reviewed migration.
- [ ] Configure Google OAuth, Turnstile, ES256 JWKs, and service-binding keys.
- [ ] Configure the Cloudflare Workers AI binding, custom domains, and service
      bindings in the Cloudflare account.
- [ ] Run Wrangler dry runs, deploy from the main-branch workflow, and perform
      representative live auth/chat/export/delete smoke checks.
- [ ] Keep Pages on its existing Git-integrated deployment for the same push.

## Related sweeps

- Next: [[plans/portfolio-agent/implementation-sweeps/02-reconnect-and-csrf-boundary-hardening|Sweep 2 — reconnect and CSRF boundary hardening]]
