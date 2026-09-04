---
title: Sweep 37 — Cookie-authenticated WebSocket gateway
aliases:
  - Portfolio Agent Sweep 37
  - Luna assistant rollout plan
tags:
  - plan
  - agents
  - cloudflare
  - security
  - websockets
role: project-plan-sweep
status: in_progress
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-04
risk: high
---

# Sweep 37 — Cookie-authenticated WebSocket gateway

Back to [[plans/portfolio-agent/README|the reliability plan]],
[[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]],
or [[architecture/portfolio-agent|the assistant architecture]].

## Objective

Remove browser-visible bearer credentials from the assistant WebSocket URL and
prevent MCP or Durable Object restart work from failing the initial handshake.
Keep the existing token route available only as a bounded rollout and rollback
compatibility path until the new gateway has passed a live soak.

## Locked design

1. The active frontend calls `POST /agent/prepare` with the HttpOnly session
   cookie, then connects `useAgent` to public-auth with only an opaque `rid`
   request identifier and the SDK's `_pk` connection key.
2. Public-auth revalidates origin, session, Turnstile state, administrator
   pause state, and owned-thread state on every upgrade. It forwards the
   WebSocket request through the private `AGENT_WORKER` service binding.
3. The agent accepts the forwarded request only on its internal route with the
   shared service-binding key, validates the trusted identity handoff against
   the thread path, and removes browser cookies/authorization before routing to
   `PortfolioAgent`.
4. `PortfolioAgent` explicitly uses `hibernate: true`; `onStart` performs only
   synchronous SQLite schema/identity work. MCP connection and bounded recovery
   happen lazily when the first model turn needs evidence.
5. Public-auth and agent diagnostics contain only allowlisted lifecycle fields
   and bounded request IDs. Playwright inspects console, page-error,
   request-failure, and WebSocket events without retaining raw URLs, headers,
   cookies, or messages.

## Luna sequence and checkpoints

Luna must execute these checkpoints in order. A failed checkpoint stops the
sequence and records the failure evidence; it must not skip ahead or deploy
another surface.

### Checkpoint 0 — Local source/build gate (complete)

- Run the fixed repository verification profile, including typecheck, lint,
  Biome, build, docs, API, MCP, public-auth, agent, and web tests.
- Confirm the saved Google auth file is ignored and mode `600`; confirm no raw
  credential-shaped value is in the changed repository files.
- Confirm Playwright `--list` loads the redacted audit and the live model test is
  skipped unless `PLAYWRIGHT_LIVE_ASSISTANT=1`.

Pass evidence: repository full profile passed; public-auth 30 tests, agent 63
tests, web 110 tests, docs check passed, and 18 Playwright tests list without
launching a browser. No deployment or live browser replay is implied.

### Checkpoint 1 — Agent Worker compatibility (approval gate)

Run the agent dry run, then deploy only after explicit operator approval. Verify
that the deployed version contains the internal WebSocket route, the hibernation
option, and the local-only `onStart`. Probe the internal route with a wrong key,
wrong identity, missing upgrade, and valid service-binding request.

Pass milestone: the agent returns bounded 403/401/426 failures, accepts only the
trusted route shape, and emits `agent-start`/`ws-connect` diagnostics without
raw request data. Do not continue if the internal key or Durable Object
migration/configuration is inconsistent.

Execution evidence (2026-09-04): the production deployment completed as Worker
version `0e8338e1-d21d-4b5b-827b-cfc35ef0d559`. Wrong-key, missing-key, and
missing-upgrade probes returned `403`; the public route without a token returned
`401`. The valid service-binding identity/`101` probe is deferred to Checkpoint 2.

### Checkpoint 2 — Public-auth gateway (approval gate)

Deploy public-auth after Checkpoint 1. Verify `/agent/prepare` returns only
`ready`, the thread ID, and an opaque attempt ID. Verify a browser-shaped
upgrade is rechecked for origin/session/Turnstile/pause/ownership and forwarded
through `AGENT_WORKER`; inspect the downstream request only in redacted form.
Exercise the service-binding failure path and confirm the bounded 502 response.

Pass milestone: no browser response or request URL contains a bearer token, and
the gateway/agent diagnostics share a bounded request-correlation channel.

Execution evidence (2026-09-04): public-auth deployed as Worker version
`c36318cf-942e-4382-89ca-92f8f756863a` with migration application skipped.
Unauthenticated, untrusted-origin, malformed-body, missing-upgrade, and
foreign-thread probes returned bounded `401`, `403`, `400`, `426`, and `404`
responses. With the saved Google session, an owned thread returned preparation
keys `attemptId`, `ready`, and `threadId`; the native WebSocket opened through
public-auth and the redacted audit recorded only `websocket-created`, with no
credential or error event.

### Checkpoint 3 — Pages client release (approval gate)

Release the active Pages build after both Worker checkpoints. Confirm the
frontend uses `public-auth.syn-forge.com`, `/agent/prepare`, `rid`, bounded
reconnects, and the in-panel retry state. Keep Pages separate from Worker
verification and do not infer live behavior from a successful build.

Pass milestone: the browser WebSocket URL contains no token parameter and the
old generated traces/HAR artifacts remain excluded from the repository.

### Checkpoint 4 — Authenticated live smoke (paid/live approval gate)

With the manually saved Google session and Turnstile completed, run only the
desktop live test:

```bash
PLAYWRIGHT_LIVE_ASSISTANT=1 npm run test:e2e -- --project=desktop
```

The redacted audit must show a successful WebSocket creation, no JWT-shaped URL
or console value, no premature-close error, no page/request/socket error, and a
grounded response with a recorded tool call and source disclosure. Record the
Worker version, request ID, status, and timestamp without copying cookies,
headers, prompts, model output, or raw URLs. This checkpoint can consume the
rolling Workers AI budget.

### Checkpoint 5 — Soak and legacy retirement (separate approval)

Keep `/agent/token` available through the agreed soak window. Compare gateway
success/failure diagnostics with the legacy path, then make a separate reviewed
change to remove the legacy route and unused frontend configuration. Do not
combine retirement with the first gateway release.

## Rollback and stop rules

For a gateway regression, roll Pages back to the last client using `/agent/token`
first, then public-auth, then the agent if its internal route or hibernation
change must be removed. A Worker rollback does not undo D1 or Durable Object
state and does not revoke already-issued short-lived legacy tokens; follow the
normal auth incident procedure if a token may still be valid. Stop on any raw
credential in browser telemetry, unexpected cross-thread authorization, a
premature-close console error, or a mismatch between deployed Worker versions.

## Evidence ledger

| Claim | Status | Evidence | Scope and caveat |
| --- | --- | --- | --- |
| Active source path does not request a bearer token | `verified-repository` | `PortfolioAssistantFab.tsx`, `portfolioAssistantApi.ts`, web tests | Current uncommitted checkout; legacy API remains for rollback |
| Gateway strips browser credentials and arbitrary query values | `verified-live` | public-auth Worker `c36318cf-942e-4382-89ca-92f8f756863a`, authenticated prepare/upgrade probes, gateway tests | Full model/grounded-response smoke remains Checkpoint 4; no secret values recorded |
| Agent validates internal identity and keeps public route separate | `verified-live-partial` | `portfolio-agent/src/index.ts`, internal route tests, authenticated gateway `101` smoke | End-to-end gateway proves the handoff; direct internal-key probing remains intentionally unexposed |
| Agent hibernation is explicit and MCP is outside `onStart` | `verified-repository` and `verified-external` | `agent.ts`, identity tests, [Agents class docs](https://developers.cloudflare.com/agents/runtime/lifecycle/agent-class/), [DO WebSocket docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) | Current source/build evidence; deployed eviction behavior pending |
| Query-string credential exposure is reduced | `verified-repository` and `verified-external` | redacted audit tests, [OWASP guidance](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url) | Browser/production telemetry pending Checkpoint 4 |
| Agent production deployment | `verified-live` | Worker version `0e8338e1-d21d-4b5b-827b-cfc35ef0d559` deployed; denial probes passed and public-auth opened a native WebSocket through the internal service binding | Durable Object eviction behavior and full model response remain pending Checkpoints 4–5; no secret values recorded |

## Current handoff

Checkpoint 0 is complete. Checkpoints 1 and 2 are complete for deployment,
denial, preparation, and no-model WebSocket handshake evidence. The active
Pages asset still contains the legacy `/agent/token` marker and no
`/agent/prepare` marker, so Checkpoint 3 remains unexecuted. Durable Object
eviction behavior, the authenticated model/grounded-response smoke, and the
soak remain pending Checkpoints 4–5. The source changes are intentionally
uncommitted; Pages, D1 migration application, secret rotation, and production
data changes remain separately gated.
