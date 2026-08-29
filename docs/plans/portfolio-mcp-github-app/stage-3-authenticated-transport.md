---
title: Stage 3 — Authenticated GitHub Transport
aliases: [Portfolio MCP GitHub authentication transport]
tags: [plan, mcp, github]
role: project-plan-stage
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
stage: 3
milestone: M3
owner: Operator-Syn
risk: high
depends_on: [stage-2-token-lifecycle]
---

# Stage 3 — Authenticated GitHub Transport

## Objective

Wire the installation-token provider into the existing GitHub REST transport while retaining the public read-only contract and input boundaries.

## Implementation changes

- Extend `PortfolioMcpEnvironment` with the App configuration required by the token provider.
- Keep token acquisition in a dedicated provider seam so the transport can receive a credential callback and tests can inject deterministic tokens.
- Add `Authorization: Bearer <installation-token>` to every GitHub request created by `workers/portfolio-mcp/src/github/transport.ts`.
- Keep `Accept`, `User-Agent`, API version, eight-second timeout, response-size cap, fixed `api.github.com` origin, and strict path checks unchanged.
- Never forward inbound MCP headers to GitHub; the Worker remains the sole authority for upstream authorization.
- Keep `createGitHubClient` and cache injection testable for all four tools.

## Tool coverage

| Tool | Behavior to preserve |
| --- | --- |
| `get_project_repository` | Metadata, `main` branch, README/history availability probes |
| `get_project_readme` | Root `README.md`, `main` only, bounded chunks |
| `list_project_commits` | Bounded pages and server-issued `main:<page>` cursor |
| `get_project_commit` | Main reachability, immutable SHA detail, bounded changed files |

## Error behavior

- Keep `RATE_LIMITED` for GitHub `429` and qualifying rate-limit `403` responses.
- Keep `INTERNAL_ERROR` for non-rate-limit `403`, configuration failures, timeouts, invalid JSON, and other upstream failures.
- Never return GitHub bodies, token details, rate-limit secrets, or stack traces.
- Preserve stable public `{ code, message }` envelopes.

## Tests

- Assert exact bearer-header construction with a fake token.
- Assert inbound `Authorization` cannot replace the Worker token.
- Assert all four tools use the injected provider.
- Assert absent App configuration cannot fall back to unauthenticated requests.
- Assert cache hits return data without invoking GitHub.
- Re-run URL, branch, size, pagination, and output-schema regressions.

## Exit gate — M3

Mark `verified` only when authenticated mock requests pass for repository, README, commit-list, and commit-detail flows; no unauthenticated fallback exists; and the diff does not broaden the public contract.

## Rollback

Keep provider and transport changes independently revertible. If production auth fails, disable the secret-backed path or roll back the Worker version; do not silently restore unauthenticated traffic.

## References

- [[plans/portfolio-mcp-github-app/references|Plan references]]
- [[architecture/portfolio-mcp|Public MCP architecture]]
