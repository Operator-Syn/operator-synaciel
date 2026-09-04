---
title: Authenticated Identity Blueprint Repository Map
aliases:
  - Identity gateway source map
  - Realtime security implementation map
tags:
  - blueprint
  - audit
  - architecture
role: audit
status: verified-repository
last_verified: 2026-09-04
source_scope: "Operator-Syn revision 2e5cc19; confirm after source changes"
related:
  - "[[authenticated-identity-blueprint|Blueprint index]]"
  - "[[authenticated-identity-blueprint/audits/evidence-ledger|Evidence ledger]]"
---

# Repository Map

This map records the current adapter seams confirmed by a narrow Graphify query
and direct source inspection. It is a source index, not a claim that every
helper is public.

## Boundary seams

| Source boundary | Responsibility | Related blueprint note |
| --- | --- | --- |
| `apps/portfolio-web/src/components/portfolioAssistant/PortfolioAssistantFab.tsx` | connection gate, opaque preparation ID, public-auth host, bounded reconnect/timeout, retry UI | gateway and testing |
| `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantApi.ts` | credentialed HTTP, preparation response validation, session/history calls | session and gateway |
| `apps/portfolio-web/src/components/portfolioAssistant/portfolioAssistantConfig.ts` | explicit public-auth origin selection and validation | gateway and rollout |
| `workers/portfolio-public-auth/src/index.ts` | session lookup, origin policy, challenge/control gate, ownership check, WebSocket forwarding | session and handoff |
| `workers/portfolio-public-auth/src/config.ts` | public-auth bindings and lifecycle constants | adapter and rollout |
| `workers/portfolio-agent/src/index.ts` | authenticated internal route, path binding, header normalization, Durable Object routing | handoff and gateway |
| `workers/portfolio-agent/src/identity.ts` | bounded identity parsing and resource binding | handoff |
| `workers/portfolio-agent/src/agent.ts` | hibernating stateful runtime, SQLite identity, `onStart`, `onConnect`, lazy upstream | runtime and hibernation |
| `workers/portfolio-agent/src/mcp.ts` | bounded upstream discovery/recovery and diagnostics | runtime and observability |
| `workers/portfolio-agent/src/diagnostics.ts` | allowlisted lifecycle event normalization | observability |
| `tests/portfolio-public-auth/agent-gateway.test.ts` | preparation, origin/session/ownership, forwarding, header stripping, failure mapping | gateway tests |
| `tests/portfolio-agent/internal-websocket.test.ts` | internal key, upgrade, path, and retired public route | handoff tests |
| `tests/portfolio-agent/identity.test.ts` | handoff parsing, thread binding, hibernation/startup seam | runtime tests |
| `tests/portfolio-web/playwright-observability.ts` | URL redaction, JWT detection, premature-close and browser error detection | browser audit |
| `tests/portfolio-web/google-authenticated.spec.ts` | saved-auth session, WebSocket audit, and responsive matrix checks | browser audit |

## Confirmed relationships

```text
Browser
  -> PortfolioAssistantFab
  -> portfolioAssistantApi /agent/prepare
  -> public-auth session + ownership boundary
  -> AGENT_WORKER service binding
  -> portfolio-agent internal route
  -> PortfolioAgent Durable Object
  -> lazy MCP/provider work
```

Graphify query used for reconnaissance:

```bash
pipenv run graphify query "public-auth portfolio-agent WebSocket identity"
```

The query was limited to shallow call/field context, then each relevant source
path above was read directly. Graphify output is navigation evidence; source and
tests remain authoritative when they disagree.

## Maintenance rule

When a route, header, binding, lifecycle hook, storage table, diagnostic phase,
or browser event changes, update this map and the affected blueprint note in the
same change. Keep deployment IDs and mutable runtime observations in the
evidence ledger instead of this structural map.
