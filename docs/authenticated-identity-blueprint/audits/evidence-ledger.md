---
title: Authenticated Identity Blueprint Evidence Ledger
aliases:
  - Realtime gateway evidence
  - Identity security evidence
tags:
  - blueprint
  - audit
  - evidence
  - security
role: audit
status: verified-repository
last_verified: 2026-09-04
source_scope: "Operator-Syn revision 2e5cc19 plus recorded production and repository/browser checks"
related:
  - "[[authenticated-identity-blueprint|Blueprint index]]"
  - "[[authenticated-identity-blueprint/audits/repository-map|Repository map]]"
  - "[[authenticated-identity-blueprint/audits/unresolved-questions|Unresolved questions]]"
---

# Evidence Ledger

Statuses describe the scope of the evidence, not permanent confidence.

| Claim | Evidence | Status | Scope and caveat |
| --- | --- | --- | --- |
| Browser does not request a reusable realtime bearer credential | frontend API/FAB source, web tests, active Pages marker scan, saved-auth audit | `verified-live` | current WebSocket uses public-auth with `rid`; one unused legacy host literal remains in the older bundle |
| Session and resource ownership are checked before upgrade | public-auth `authorizeAgentThread`, gateway tests, live unauthenticated/foreign-boundary probes | `verified-live` | session and thread ownership are rechecked at the actual upgrade |
| Internal routing is private and authenticated | `AGENT_WORKER`, internal key check, identity parser, header-stripping tests | `verified-live` | service binding and internal key are adapter-specific |
| Handoff is bound to the stateful resource | `parseAgentIdentity`, requested thread comparison, identity tests, saved-auth WebSocket | `verified-live` | no raw handoff or request ID is retained in this note |
| Startup does not depend on upstream discovery | `PortfolioAgent.onStart`, `identity.test.ts`, lazy MCP implementation | `verified-repository` | runtime eviction/restart telemetry is not continuously collected |
| Hibernation is enabled for the stateful runtime | Agents SDK options, Wrangler Durable Object class, Cloudflare lifecycle/WebSocket references | `verified-repository` and `verified-external` | exact eviction timing and attachment behavior remain platform/version-sensitive |
| Browser and server diagnostics are redacted | `playwright-observability.ts`, `diagnostics.ts`, redaction tests, saved-auth run | `verified-live` | redaction proves retained output is bounded, not that an external system has no other logs |
| Production retirement is deployed in compatible order | Wrangler deploy output, public-auth/agent version records, live route probes | `verified-live` | agent deployed before public-auth; Pages remains a separate surface |
| Historical token table is retained without active issuance/verification | migration plus current source route scan | `verified-repository` | deletion/cleanup is a separate authorized operation |
| OAuth transaction state uses provider-independent protections | current source plus RFC/OWASP references | `verified-repository` and `verified-external` | provider configuration and account policy require separate verification |

## Recorded production snapshot

- `portfolio-agent`: version `dcab1312-ae9b-4f0b-ac70-c16ef69b6b7c`.
- `portfolio-public-auth`: version `31f80f41-efe2-4be1-875b-5d9c98cdf9b0`.
- `/agent/token`: `404`.
- Direct public agent route: `404`.
- Unauthenticated `/agent/prepare`: `401`.
- Public-auth `/health`: `200`.
- Saved-auth desktop Playwright suite: 3 tests passed; redacted audit found no
  credential/JWT signal, premature-close error, or unexpected browser event.

## Recorded repository/browser verification

- Nix-backed `npm run test:e2e`: 12 saved-auth and responsive checks passed;
  6 model-generating checks were skipped by the explicit opt-in guard.
- The local Vite HMR token is allowlisted only for its exact development socket;
  public-auth/agent token-shaped URLs remain audit failures.

No cookies, JWTs, private keys, raw request IDs, prompts, or raw provider
responses are stored here. Recheck the live snapshot after every deployment.

## Verification commands

```text
npm run docs:check
npm run skills:check
npm run test:public-auth
npm run test:portfolio-agent
npm run test --workspace=@syn-forge/portfolio-web --
nix develop --command npm run test:e2e
nix develop --command bash -lc '... PLAYWRIGHT_LIVE_ASSISTANT=1 npm run test:e2e -- --project=desktop'
```

The commands above are evidence recipes. They do not grant deployment,
migration, secret, or log-access authority.
