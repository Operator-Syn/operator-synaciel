---
title: Sweep 15 — production Worker access from local Vite
aliases:
  - Portfolio Agent Sweep 15
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

# Sweep 15 — production Worker access from local Vite

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** production Worker CORS/return-target configuration, credentialed
localhost requests, and the selected local-development workflow.

- [x] The production `BROWSER_ORIGINS` Wrangler values are parameterized and
      include only the exact `http://localhost:5173` origin in addition to the
      production portfolio origins.
- [x] OAuth return-target validation now consumes that same configured list, so
      a production callback can safely return to localhost without an open
      redirect.
- [x] Production public-auth uses an explicit `SESSION_COOKIE_SAME_SITE` value
      of `None` for credentialed cross-site requests while retaining Secure and
      HttpOnly attributes and Origin checks.
- [x] The frontend example and local-development guide now select the
      production auth/agent Workers by explicit Vite values; the isolated local
      Worker profile remains documented as an alternative.
- [x] Deployment-path and public-auth security tests cover the parameterized
      localhost origin, rejected origins, local return targets, and cookie mode.

No production variable or Worker deployment was changed in this sweep. The
operator must deploy the updated Worker configuration and ensure the production
Turnstile widget permits localhost before browser testing.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/14-environment-aware-local-assistant-configuration|Sweep 14 — environment-aware local assistant configuration]]
- Next: [[plans/portfolio-agent/implementation-sweeps/16-async-agent-connection-render-guard|Sweep 16 — async agent connection render guard]]
