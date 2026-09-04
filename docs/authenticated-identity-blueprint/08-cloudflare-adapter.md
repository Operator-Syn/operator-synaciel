---
title: Cloudflare Adapter for the Authenticated Identity Blueprint
aliases:
  - Cloudflare Workers identity gateway
  - Workers Durable Object auth adapter
tags:
  - blueprint
  - cloudflare
  - workers
  - durable-objects
  - adapter
role: reference
status: verified-repository
last_verified: 2026-09-04
source_scope: "Operator-Syn revision 2e5cc19 plus recorded production evidence"
related:
  - "[[authenticated-identity-blueprint|Blueprint index]]"
  - "[[architecture/portfolio-public-auth|Public-auth architecture]]"
  - "[[architecture/portfolio-agent|Portfolio agent architecture]]"
  - "[[authenticated-identity-blueprint/audits/evidence-ledger|Evidence ledger]]"
---

# Cloudflare Adapter

This note is the concrete mapping of the universal blueprint onto the current
Operator-Syn implementation. It is not the portable contract; replace these
names and routes when adapting the design elsewhere.

## Placeholder mapping

| Universal concept | Current implementation |
| --- | --- |
| `{{PRINCIPAL}}` | Google subject (`sub`) |
| `{{SESSION_STORE}}` | public-auth D1 `sessions` and `users` |
| `{{GATEWAY}}` | `portfolio-public-auth` Worker |
| `{{INTERNAL_CHANNEL}}` | `AGENT_WORKER` service binding plus internal key |
| `{{STATEFUL_RUNTIME}}` | `PortfolioAgent` Agents SDK Durable Object |
| `{{RESOURCE_ID}}` | owned assistant thread ID |
| `{{AUTHORIZATION_EPOCH}}` | user `quota_epoch` plus session revocation state |
| `{{OBSERVABILITY_SINK}}` | allowlisted Worker diagnostics and redacted Playwright audit |
| `{{UPSTREAM}}` | Portfolio MCP catalog/provider calls |

## Boundary ownership

| Surface | Owner | Contract |
| --- | --- | --- |
| Browser authentication | public-auth | Google OIDC callback creates a hashed HttpOnly session |
| Browser HTTP | public-auth | credentialed requests require configured origin policy |
| Preparation | public-auth | `POST /agent/prepare` rechecks session, challenge, pause, and thread ownership |
| Browser WebSocket | public-auth | `GET /agents/portfolio-agent/:id` repeats checks and forwards only normalized metadata |
| Private routing | portfolio-agent | internal key, identity header, path binding, and WebSocket upgrade are required |
| Stateful chat | PortfolioAgent | hibernating Agent object persists identity and queues messages |
| Upstream evidence | PortfolioAgent | MCP discovery is lazy and bounded after connection |
| Browser audit | Playwright helper | URL values are discarded; event kinds and query names remain |

## Source map

- [Frontend gate](../../apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx)
  obtains an opaque preparation ID, connects to public-auth, and uses bounded
  retries/timeouts.
- [Frontend API](../../apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts)
  sends credentialed HTTP requests and validates the preparation response.
- [Frontend config](../../apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts)
  requires an explicit, valid public-auth origin and rejects retired agent-host
  overrides.
- [Public-auth gateway](../../workers/portfolio-public-auth/src/index.ts)
  owns origin/session/challenge/control/thread checks and private forwarding.
- [Agent entrypoint](../../workers/portfolio-agent/src/index.ts) exposes only
  internal routes and strips browser credentials before routing.
- [Identity parser](../../workers/portfolio-agent/src/identity.ts) validates
  shape and thread binding.
- [Agent lifecycle](../../workers/portfolio-agent/src/agent.ts) opts into
  hibernation, performs synchronous startup, and connects upstream lazily.
- [Diagnostics](../../workers/portfolio-agent/src/diagnostics.ts) keeps
  lifecycle events allowlisted.
- [Browser audit](../../tests/portfolio-web/playwright-observability.ts)
  flags JWT-shaped URLs, sensitive query names, premature-close text, and
  unexpected page/request/socket errors. Local development also exposes Vite's
  HMR socket; the audit allowlists only the exact
  `ws://localhost:5173/?token=...` or
  `ws://127.0.0.1:5173/?token=...` shape. A token on a public-auth or agent
  URL remains a failure.
- [Saved-auth browser spec](../../tests/portfolio-web/google-authenticated.spec.ts)
  reuses manually captured Google state, checks the authenticated session
  boundary, and exercises responsive geometry without retaining credentials.

## Configuration and bindings

The production adapter declares:

- `AGENT_WORKER` as a public-auth service binding to `portfolio-agent`;
- a `PortfolioAgent` SQLite Durable Object class;
- an `AUTH_DB` D1 binding for sessions, users, threads, and quota records;
- `BROWSER_ORIGINS` and explicit public origins;
- a Workers AI binding and public MCP URL for the agent.

The checked-in configurations are
[public-auth Wrangler](../../workers/portfolio-public-auth/wrangler.toml) and
[agent Wrangler](../../workers/portfolio-agent/wrangler.toml). Runtime secret
values are intentionally not reproduced here.

## Current route contract

| Route | Expected unauthenticated result | Purpose |
| --- | ---: | --- |
| `POST /agent/prepare` | `401` | authenticated preparation and ownership check |
| `GET /agents/portfolio-agent/:id` on public-auth | `401` or `403` without valid session/origin | authenticated browser upgrade |
| `POST /agent/token` on public-auth | `404` | retired bearer-token route |
| direct agent public path | `404` | no browser-facing agent route |
| `GET /health` on public-auth | `200` | liveness only, not chat proof |

The route table is a representative live boundary check, not a substitute for
authenticated behavior. See the evidence ledger for deployment scope.

## Cloudflare-specific lifecycle notes

Cloudflare service bindings keep the agent off the browser’s public network
path and require the target Worker to exist before the caller deploys. The
Agents SDK exposes `onStart` and `onConnect`; this adapter uses startup for
SQLite identity rehydration and connection time for the trusted handoff.
`hibernate: true` permits the stateful object to sleep while supported
WebSockets remain managed by the platform. The adapter must persist state that
cannot be reconstructed after memory eviction.

These claims are version-sensitive. Refresh them against the
[Agents lifecycle documentation](https://developers.cloudflare.com/agents/runtime/lifecycle/agent-class/),
[Agents WebSocket documentation](https://developers.cloudflare.com/agents/runtime/communication/websockets/),
[Durable Object lifecycle documentation](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/),
[Durable Object WebSocket documentation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
and [service binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/).
