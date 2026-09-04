---
title: Sweep 13 — local versus production configuration audit
aliases:
  - Portfolio Agent Sweep 13
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

# Sweep 13 — local versus production configuration audit

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-08-29  
**Scope:** localhost OAuth behavior, Vite endpoint resolution, and Worker
environment boundaries.

- [x] Reproduced the reported redirect behavior: the frontend falls back to
      `https://public-auth.syn-forge.com` when `VITE_PUBLIC_AUTH_URL` is absent.
- [x] The production auth Worker accepts only its configured production origin
      for `returnTo`, so a localhost target is reduced to `https://syn-forge.com`.
- [x] The frontend also falls back to the production agent URL, while the
      local build has no `VITE_PUBLIC_AUTH_URL`, `VITE_PORTFOLIO_AGENT_URL`, or
      `VITE_TURNSTILE_SITE_KEY` override.
- [x] Production Worker TOML values are intentionally production-specific, but
      there is no explicit local Worker environment/profile for OAuth callback
      and origin values.
- [ ] The active fix goal will add explicit local/production configuration,
      local callback support, and regression coverage; it will not weaken the
      production origin allowlist or commit secret values.

The audit did not change runtime behavior. The current production defaults are
safe for production but unsuitable for an isolated localhost OAuth flow.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/12-oauth-authorization-start-verification|Sweep 12 — OAuth authorization-start verification]]
- Next: [[plans/portfolio-agent/implementation-sweeps/14-environment-aware-local-assistant-configuration|Sweep 14 — environment-aware local assistant configuration]]
