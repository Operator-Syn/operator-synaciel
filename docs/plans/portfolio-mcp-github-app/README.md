---
title: Syn-Forge Portfolio MCP GitHub App Rate-Limit Hardening
aliases:
  - Portfolio MCP GitHub App plan
tags: [plan, mcp, github, cloudflare]
role: project-plan
status: in_progress
plan_id: portfolio-mcp-github-app-rate-limit-hardening
owner: Operator-Syn
created: 2026-08-29
last_reviewed: 2026-08-29
risk: high
scope: public portfolio MCP GitHub read path
source_of_truth: [workers/portfolio-mcp/, docs/architecture/portfolio-mcp.md]
---

# Syn-Forge Portfolio MCP GitHub App Rate-Limit Hardening

> Status: `in_progress` — the plan is published; implementation stages remain `planned` until their exit gates are evidenced.

## Purpose

Move the public portfolio MCP's GitHub reads from unauthenticated, outbound-IP-based requests to a least-privilege GitHub App installation token. Preserve the read-only public contract while adding bounded traffic resilience.

This plan covers five implementation stages, cross-cutting sweeps, milestone gates, verification evidence, and operational ownership. It contains no credentials, private keys, JWTs, installation tokens, or claims that deployment has occurred.

## Current baseline

- `workers/portfolio-mcp/src/github/transport.ts` sends GitHub GET requests with `Accept`, `User-Agent`, and `X-GitHub-Api-Version`; it has no `Authorization` header.
- The four GitHub tools share one transport and the same unauthenticated upstream quota; the MCP Worker has no application-level user/session/tool bucket.
- GitHub `429`, and qualifying rate-limit `403` responses (`x-ratelimit-remaining: 0` or `Retry-After`), become the stable MCP `RATE_LIMITED` envelope.
- Successful GitHub responses use separate synthetic cache keys with explicit repository, README, commit-list/reachability, and commit-detail TTLs.
- The Worker is stateless and public; Cloudflare edge controls and production deployment are separate operational boundaries.

## Decisions

| Decision | Selected approach | Reason |
| --- | --- | --- |
| Credential | GitHub App installation access token | Service-owned, repository-scoped, rotatable, and higher quota than unauthenticated requests |
| Installation scope | Only repositories linked by published portfolio projects | Limits blast radius and follows the existing project-link boundary |
| Permissions | Repository metadata and contents, read-only | Fixed reads require no writes, hooks, issues, or administration |
| Storage | Cloudflare Worker Secrets | Keeps private key and identifiers out of source and MCP traffic |
| User safeguard | Cloudflare edge rule keyed by client IP | Current public MCP has no authenticated user identity; limitation stays explicit |
| Cache | Existing shared GitHub cache namespace and TTLs | Reduces repeated upstream calls without changing output semantics |
| Retry | Bounded, header-aware backoff; no unbounded automatic retry | Prevents retry storms and respects GitHub limits |

## Stage status

| Stage | Note | Status | Exit gate | Depends on |
| --- | --- | --- | --- | --- |
| 1 | [[plans/portfolio-mcp-github-app/stage-1-github-app|GitHub App foundation]] | planned | App installed with reviewed scope and read-only permissions | — |
| 2 | [[plans/portfolio-mcp-github-app/stage-2-token-lifecycle|Token lifecycle]] | planned | Secret bindings and one-hour token renewal tested without real credentials | 1 |
| 3 | [[plans/portfolio-mcp-github-app/stage-3-authenticated-transport|Authenticated transport]] | planned | Four GitHub tools send server-side bearer auth and preserve boundaries | 2 |
| 4 | [[plans/portfolio-mcp-github-app/stage-4-rate-resilience|Rate resilience]] | planned | Cache, backoff, and edge controls prevent avoidable quota exhaustion | 3 |
| 5 | [[plans/portfolio-mcp-github-app/stage-5-verification-rollout|Verification and rollout]] | planned | Source, tests, deployment, and live behavior separately evidenced | 4 |

## Milestones

- **M1 — App foundation:** ownership, selected repositories, permissions, installation ID, and App ID reviewed.
- **M2 — Credential lifecycle:** secret contract, JWT/token exchange, renewal, and failure paths verified with mocks.
- **M3 — Authenticated transport:** only Worker-side credentials authorize GitHub; inbound client headers cannot override them.
- **M4 — Resilience:** cache hits avoid upstream calls, rate errors remain bounded, and edge controls constrain abusive clients.
- **M5 — Production handoff:** dry run, secret setup, deployment, smoke checks, monitoring, and rollback evidence complete.

## Workstreams

- **Development:** stages 2–4 change only the Worker environment contract, token provider, GitHub transport, and bounded error/backoff behavior.
- **Verification:** stage 5 runs focused checks, then fixed portfolio-MCP and documentation profiles; no load testing is included.
- **Operations:** Cloudflare secret management, edge rate limiting, deployment, monitoring, and rollback remain approval-gated user-owned actions.
- **Documentation:** this plan is linked from [[architecture/portfolio-mcp|the public MCP architecture note]].

## Scope boundaries

In scope: GitHub App authentication for the existing four GitHub-backed tools, secret/token lifecycle, rate-limit classification, cache preservation, bounded backoff, edge protection, tests, documentation, and rollout evidence.

Out of scope: portfolio API authentication redesign, MCP client authentication, arbitrary GitHub repository/path access, write operations, D1/R2 changes, database migrations, deployment without separate authorization, and high-volume/load testing.

## Evidence rules

- Source inspection establishes declarations and control flow.
- Typecheck/tests establish local behavior only.
- Wrangler dry run establishes package/config validity, not deployment.
- Secret upload and deployment are separate approval-gated actions.
- Live smoke checks establish representative deployed behavior only; they do not establish capacity or a global quota guarantee.
- Record passed, failed, partially run, blocked, or not-run checks and distinguish task-related failures from unrelated worktree failures.

## Status protocol

Update each file's `status`, `last_reviewed`, and milestone row after a gate. Add evidence links or command summaries without copying secret values. Mark a stage `verified` only when its exit gate is met; use `blocked` only for an external dependency that prevents safe progress.

## Navigation

- [[plans/portfolio-mcp-github-app/stage-1-github-app|Stage 1 — GitHub App foundation]]
- [[plans/portfolio-mcp-github-app/stage-2-token-lifecycle|Stage 2 — Token and secret lifecycle]]
- [[plans/portfolio-mcp-github-app/stage-3-authenticated-transport|Stage 3 — Authenticated GitHub transport]]
- [[plans/portfolio-mcp-github-app/stage-4-rate-resilience|Stage 4 — Rate-limit resilience]]
- [[plans/portfolio-mcp-github-app/stage-5-verification-rollout|Stage 5 — Verification and rollout]]
- [[plans/portfolio-mcp-github-app/sweeps-and-milestones|Cross-cutting sweeps and milestone checklist]]
- [[plans/portfolio-mcp-github-app/references|References and source map]]
- [[architecture/portfolio-mcp|Current MCP architecture]]
