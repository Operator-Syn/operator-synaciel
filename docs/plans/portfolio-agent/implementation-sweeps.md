---
title: Portfolio Agent Implementation Sweeps
aliases:
  - Portfolio agent sweeps
tags:
  - plan
  - agents
  - verification
role: project-plan-checklist
status: in_progress
plan_id: portfolio-agent-public-assistant
owner: Operator-Syn
last_reviewed: 2026-08-29
risk: high
---

# Portfolio Agent Implementation Sweeps

This note records each bounded implementation sweep for the public portfolio
assistant. It distinguishes source/build evidence from approval-gated
Cloudflare provisioning, deployment, and live behavior.

## Sweep 1 — source implementation and hard limits

**Date:** 2026-08-29  
**Scope:** public-auth Worker, agent Worker, global FAB chat surface, deployment
graph, tests, and canonical notes.

- [x] Google OIDC authorization-code + PKCE, state, nonce, fixed callback, and
      verified-email validation.
- [x] Host-only session cookie, hashed session IDs, one-time five-minute
      scoped agent tokens, ES256 verification, and WebSocket path binding.
- [x] D1 schema for users, sessions, threads, tokens, usage windows, and admin
      control; no automatic migration application.
- [x] Portfolio MCP `search_portfolio` preflight and fail-closed evidence gate.
- [x] **10 model passes** and **20 MCP calls including preflight**; regression
      test covers budget exhaustion.
- [x] GitHub tools require explicit repository context; unsafe requests receive
      a bounded refusal.
- [x] Durable thread persistence, compaction notice, sanitized export, delete,
      30-day retention cleanup, burst/day quotas, aggregate neuron pause, and
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

## Sweep protocol

For each later change, update this note with the date, bounded scope, changed
contracts, exact checks, and any live or provisioning evidence. Do not mark
deployment or live behavior complete from source or build output alone.

## Sweep 2 — reconnect and CSRF boundary hardening

**Date:** 2026-08-29  
**Scope:** one-time agent-token lifecycle in the FAB and state-changing
public-auth requests.

- [x] Disabled the frontend agent-query cache because WebSocket credentials are
      one-use; reconnects request a fresh token.
- [x] Reset the aggregate neuron guard at the UTC day boundary while preserving
      manual pauses, and bound server-side question input to 2,000 characters.
- [x] State-changing public-auth routes fail closed when the Origin header is
      absent or outside the explicit portfolio allowlist.
- [x] Re-ran typecheck, lint, Biome, public-auth tests, frontend tests, and
      the assistant static contract test.

The live browser reconnect path and cross-site request behavior remain
deployment-time checks; no production token or cookie was inspected here.

## Sweep 3 — quota reset boundary and provisioning-documentation audit

**Date:** 2026-08-29  
**Scope:** admin reset semantics, D1 provisioning instructions, and hard-limit
completion evidence.

- [x] User-specific admin resets now clear only that user’s usage, sessions,
      and outstanding tokens; they do not resume or reset the global neuron
      guard.
- [x] Global admin resets continue to clear the aggregate neuron estimate,
      automatic pause state, and current UTC day.
- [x] The deployment runbook now names both Worker Wrangler configurations that
      must receive the shared auth D1 database ID.
- [x] Re-ran the portfolio-agent typecheck/tests and `git diff --check` after
      the boundary correction.

The source/build implementation remains complete for this plan. D1 creation and
migration application, runtime-key provisioning, Wrangler dry runs, production
deployment, Pages deployment, and live browser smoke checks remain approval-
gated external work.

## Sweep 4 — first-deploy service-binding order

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

## Sweep 5 — auth D1 database provisioning

**Date:** 2026-08-29  
**Scope:** shared auth D1 binding configuration after the operator-created
`portfolio-agent-auth` database.

- [x] The database was created in Cloudflare (APAC) with ID
      `5921ab3b-ebd6-4377-a474-4618d78f4aa4`.
- [x] The ID is recorded in both the public-auth and portfolio-agent Wrangler
      configurations.
- [x] The reviewed `0000_portfolio_agent_auth.sql` migration was applied to
      the remote database after confirmation.

The remote migration list now reports no migrations to apply; Wrangler reported
14 SQL commands executed successfully. Both public-auth and portfolio-agent
Wrangler dry runs passed. No Worker deployment was executed in this sweep.

## Sweep 6 — remote secret and deployment verification

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

## Sweep 7 — Wrangler Custom Domain declaration

**Date:** 2026-08-29  
**Scope:** public-auth routing configuration after the DNS reachability check.

- [x] `public-auth.syn-forge.com` is now declared as a Wrangler Custom Domain,
      matching the existing agent Custom Domain declaration.
- [x] Deployment-path regression coverage verifies both Custom Domain entries.
- [ ] A production deploy is still required to apply the route and allow DNS
      propagation; live auth and agent checks remain pending.

## Sweep 8 — live protected-boundary check

**Date:** 2026-08-29  
**Scope:** first live endpoint checks after the Worker secret deployments.

- [x] `assistant.syn-forge.com` resolves and rejects an unauthenticated agent
      request with HTTP `401`, confirming the protected boundary is live.
- [ ] `public-auth.syn-forge.com` still fails DNS resolution; deploy the
      updated public-auth Wrangler configuration before retrying auth checks.

No cookies, access tokens, or private response bodies were captured.

## Sweep 9 — IPv4 live health and client-network diagnosis

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

## Sweep 10 — post-restart auth health confirmation

**Date:** 2026-08-29  
**Scope:** operator-side resolver recovery and public-auth health endpoint.

- [x] After restarting the shell, Hiraeth resolved
      `public-auth.syn-forge.com` and returned the expected health payload over
      IPv4 on repeated requests.
- [x] The earlier failures are recorded as transient local resolver/cache
      state; no Cloudflare DNS change was required.
- [ ] OAuth, Turnstile, and authenticated browser chat remain the next live
      checks.

## Sweep 11 — OAuth configuration boundary

**Date:** 2026-08-29  
**Scope:** live public-auth health and Google authorization-start checks.

- [x] The public-auth health endpoint returns HTTP `200` when reached through
      a known public IPv4 edge.
- [x] The protected agent boundary remains live and returns HTTP `401` without
      an access token.
- [ ] Google authorization start currently returns HTTP `503`; configure the
      Google OAuth client ID as `GOOGLE_CLIENT_ID` on public-auth, then retry.

The OAuth callback URI remains `https://public-auth.syn-forge.com/oauth/google/callback`.
No OAuth codes, cookies, tokens, or response bodies were captured.

## Sweep 12 — OAuth authorization-start verification

**Date:** 2026-08-29  
**Scope:** live public-auth configuration after the Hiraeth resolver recovered.

- [x] `/health` returned HTTP `200`.
- [x] `/oauth/google/start` returned HTTP `302`, confirming that the Worker
      can read `GOOGLE_CLIENT_ID` and construct the Google authorization flow.
- [ ] Complete the browser redirect, callback, Turnstile, and authenticated
      chat smoke flow.

The check used a public IPv4 edge for diagnosis and did not capture the
redirect location, OAuth state, cookies, or tokens.

## Sweep 13 — local versus production configuration audit

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

## Sweep 14 — environment-aware local assistant configuration

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

## Sweep 15 — production Worker access from local Vite

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

## Sweep 16 — async agent connection render guard

**Date:** 2026-08-30
**Scope:** authenticated frontend `useAgent` setup, token-query caching,
reconnect behavior, and the user-visible failure boundary.

- [x] Reproduced the reported blank-page crash with a mocked authenticated local
      session. The exception was `An unknown Component is an async Client
      Component` at `useAgent`; no WebSocket request was reached before the
      render failure.
- [x] Confirmed the installed Agents SDK resolves function-valued `query`
      parameters with React `use()` and documents a `Suspense` boundary for
      asynchronous setup.
- [x] Wrapped the assistant chat in `Suspense` with an explicit loading state.
- [x] Replaced the zero-duration query cache with a four-minute cache, memoized
      the thread dependency list, and retained the SDK's disconnect invalidation
      path so one-time five-minute tokens refresh on reconnect.
- [x] Added an assistant-specific error boundary with a retry action for token
      promise rejection and other connection setup failures.
- [x] The regression test went red before the source fix and green afterward;
      the browser repro now renders the composer without the React crash, while
      a deliberately rejected token renders the retry state without blanking the
      portfolio shell.
- [x] Updated the architecture, local-development, and deployment notes with
      the lifecycle contract and diagnostic interpretation.
- [x] Pushed commit `344cfbd` to `main`; GitHub Actions run
      [33261570102](https://github.com/Operator-Syn/operator-synaciel/actions/runs/33261570102)
      passed validation and deployed API, MCP, portfolio-agent, and public-auth
      in order.
- [x] The production Pages bundle serves the loading fallback and retry-boundary
      strings. A controlled production-browser check with mocked auth rendered
      the chat composer without the React crash and contained a rejected token
      inside the assistant panel.
- [ ] Complete the operator-owned Google, Turnstile, real session, and real
      WebSocket smoke flow; the automation browser has no Google account
      session, so this evidence is intentionally not claimed as live auth.

The source fix does not alter OAuth origins, cookies, token claims, Worker
limits, or MCP scope.
