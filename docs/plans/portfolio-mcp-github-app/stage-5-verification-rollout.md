---
title: Stage 5 — Verification and Rollout
aliases: [Portfolio MCP GitHub App rollout]
tags: [plan, verification, deployment]
role: project-plan-stage
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
stage: 5
milestone: M5
owner: Operator-Syn
risk: high
depends_on: [stage-4-rate-resilience]
---

# Stage 5 — Verification and Rollout

## Objective

Separate local source/test evidence, Cloudflare configuration, deployment, and representative live behavior so no earlier check is mistaken for a production guarantee.

## Verification sequence

| Check | Purpose | Required status |
| --- | --- | --- |
| `npm run mcp:portfolio:check` | Worker typecheck and environment contract | passed |
| `npm run test:portfolio-mcp` | Protocol and GitHub regression coverage | passed |
| `npm run docs:check` | Vault links and layout | passed |
| `npm run typecheck` | Workspace-wide compatibility | passed or unrelated failure documented |
| `npm run build` | Workspace build compatibility | passed or unrelated failure documented |
| `npx wrangler deploy --dry-run --env="" --config workers/portfolio-mcp/wrangler.toml` | Package/config validation | passed |

Use the repository MCP fixed `mcp` or `repository` profile where available. Do not run a load test.

## Production gates

1. Confirm App installation, repository selection, permissions, App ID, and installation ID.
2. Confirm Cloudflare account/zone ownership with `npx wrangler whoami`.
3. Upload production secrets through Wrangler or the dashboard; never put values in source or command history.
4. Deploy only after source and dry-run checks pass and deployment is separately authorized.
5. Confirm Worker version and service binding target.
6. Exercise `tools/list`, one portfolio tool, and one GitHub-backed tool with low-volume smoke traffic.
7. Inspect response shape, status classification, cache behavior, and logs for absence of credential/content leakage.
8. Record deployment and live evidence separately from source/test evidence.

## Monitoring

Track safe aggregates only: GitHub requests by endpoint/status class; cache hit/miss and write failures; token-refresh outcomes and age buckets; MCP success/error classes; edge-rule matches; client-IP concentration; latency and timeouts.

Never log private keys, JWTs, installation tokens, authorization headers, portfolio document bodies, README contents, or upstream bodies.

## Rollback

- Revert or disable the Worker version through the approved Cloudflare process.
- If the App is compromised or mis-scoped, revoke/rotate the private key and uninstall or restrict the App.
- Preserve the public MCP output envelope and cache behavior during rollback.
- Do not silently fall back to unauthenticated GitHub traffic.
- Run the same low-volume smoke checks after rollback and record results.

## Exit gate — M5

Mark `verified` only when required local checks pass, production secrets and deployment are confirmed by the operator, representative live calls succeed, safe monitoring is available, and rollback ownership is clear.

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [[operations/deployment|Production deployment boundaries]]
- [[operations/local-development|Local verification commands]]
- [[architecture/portfolio-mcp|Public MCP architecture]]
