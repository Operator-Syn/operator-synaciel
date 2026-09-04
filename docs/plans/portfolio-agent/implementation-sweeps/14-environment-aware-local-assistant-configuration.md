---
title: Sweep 14 — environment-aware local assistant configuration
aliases:
  - Portfolio Agent Sweep 14
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

# Sweep 14 — environment-aware local assistant configuration

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** local OAuth return targets, frontend endpoint selection, Worker
origin allowlists, and local Wrangler profiles.

- [x] Frontend assistant endpoints now resolve through a testable environment
      helper. Development requires explicit `VITE_PUBLIC_AUTH_URL` and
      `VITE_PORTFOLIO_AGENT_URL` values; it never falls back to production.
- [x] Production defaults remain explicit, while malformed overrides surface a
      configuration error instead of being silently ignored.
- [x] Public-auth and portfolio-agent browser-origin checks now consume the
      configured `BROWSER_ORIGINS` list rather than a source-level origin list.
- [x] Both Worker Wrangler files now define `env.local` origins, local ports,
      local D1/service bindings, a locally supported compatibility date, and
      local Durable Object configuration without custom-domain routes.
- [x] Local OAuth, D1, secret-file, Turnstile, and Google callback setup is
      documented. Production secrets and remote migration application remain
      outside local testing.
- [x] Regression coverage proves explicit local endpoint selection, malformed
      origin rejection, configured browser-origin enforcement, and production
      defaults.

The source and focused checks establish the corrected routing behavior. A real
localhost Google callback still requires the operator-owned Google authorized
redirect URI, local Worker `.dev.vars`, and local Turnstile setup described in
[[operations/local-development|Local Development]].

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/13-local-versus-production-configuration-audit|Sweep 13 — local versus production configuration audit]]
- Next: [[plans/portfolio-agent/implementation-sweeps/15-production-worker-access-from-local-vite|Sweep 15 — production Worker access from local Vite]]
