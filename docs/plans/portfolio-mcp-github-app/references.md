---
title: Portfolio MCP GitHub App Plan References
aliases: [GitHub App rate-limit references]
tags: [plan, references, mcp]
role: project-plan-references
status: current
plan_id: portfolio-mcp-github-app-rate-limit-hardening
owner: Operator-Syn
last_reviewed: 2026-08-29
---

# References and Source Map

## Repository sources

- [[architecture/portfolio-mcp|Public Portfolio MCP architecture]] — stateless Worker boundary, tools, cache TTLs, error envelope, and deployment separation.
- [[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]] — module seams and ownership.
- [[operations/deployment|Production deployment]] — Cloudflare prerequisites, dry run, deployment, smoke checks, and monitoring boundary.
- [[operations/local-development|Local development]] — repository-native checks and Graphify workflow.
- `workers/portfolio-mcp/src/config.ts` — cache TTLs and bounded request/output constants.
- `workers/portfolio-mcp/src/github/transport.ts` — request headers, cache, timeout, response classification, and JSON bounds.
- `workers/portfolio-mcp/src/github/client.ts` — GitHub call fan-out for repository, README, branch, commit-list, reachability, and commit detail.
- `workers/portfolio-mcp/src/mcp/results.ts` — public error classification and `RATE_LIMITED` envelope.
- `workers/portfolio-mcp/src/mcp/tools/github.ts` — four GitHub-backed tools and input boundaries.
- `workers/portfolio-mcp/wrangler.toml` — Worker, service binding, route, and local API fallback.

## GitHub primary references

- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — primary/secondary limits, installation-token limits, and `403`/`429` behavior.
- [Rate limits for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/rate-limits-for-github-apps) — App authentication mode and installation quota rules.
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/using-github-apps/authenticating-with-github-apps) — JWT and installation-token flow.
- [Create an installation access token](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app) — token endpoint and one-hour token lifetime.
- [Permissions required for fine-grained tokens](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) — endpoint permission guidance.

## Cloudflare primary references

- [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — `wrangler secret put`, deployment behavior, and secret bindings.
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) — environment-specific variables and required secrets.
- [Cloudflare Rate Limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/) — edge policy concepts and configuration boundary.

## Evidence and freshness

External rate-limit and platform behavior is version-sensitive. Recheck the linked primary documentation at Stages 1, 4, and 5. Repository paths and constants are authoritative for the checked-out source; this plan must not override source if values change.

Do not copy tokens, private keys, full upstream response bodies, or protected dashboard output into the plan.
