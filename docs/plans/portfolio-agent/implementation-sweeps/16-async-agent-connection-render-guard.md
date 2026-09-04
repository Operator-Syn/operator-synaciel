---
title: Sweep 16 — async agent connection render guard
aliases:
  - Portfolio Agent Sweep 16
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

# Sweep 16 — async agent connection render guard

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

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
- [x] Post-deployment HTTP checks confirmed public-auth health, localhost
      credentialed CORS (`204` preflight and `401 /session` with
      `Access-Control-Allow-Origin: http://localhost:5173`), and the agent's
      origin boundary (`401` for localhost, `403` for an untrusted origin).
- [ ] Complete the operator-owned Google, Turnstile, real session, and real
      WebSocket smoke flow; the automation browser has no Google account
      session, so this evidence is intentionally not claimed as live auth.

The source fix does not alter OAuth origins, cookies, token claims, Worker
limits, or MCP scope.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/15-production-worker-access-from-local-vite|Sweep 15 — production Worker access from local Vite]]
- Next: [[plans/portfolio-agent/implementation-sweeps/17-main-teaser-release-gate-and-agent-development-branch|Sweep 17 — main teaser release gate and agent-development branch]]
