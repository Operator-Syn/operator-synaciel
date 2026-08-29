---
title: Cross-Cutting Sweeps and Milestone Checklist
aliases: [Portfolio MCP GitHub App sweeps]
tags: [plan, checklist, mcp]
role: project-plan-checklist
status: planned
plan_id: portfolio-mcp-github-app-rate-limit-hardening
owner: Operator-Syn
last_reviewed: 2026-08-29
risk: high
---

# Cross-Cutting Sweeps and Milestone Checklist

Use this checklist at every stage gate. Complete a sweep only when evidence is recorded and any exception has an owner and follow-up milestone.

## Security sweep

- [ ] App repository selection is minimal and reviewed.
- [ ] Metadata and contents permissions are read-only.
- [ ] Private key, JWT, installation token, and bearer header are absent from source, tests, docs, logs, and snapshots.
- [ ] Inbound MCP authorization headers cannot override Worker credentials.
- [ ] Missing/invalid credentials fail closed.
- [ ] App key rotation and revocation ownership are documented.

## Contract sweep

- [ ] Worker environment type and Wrangler configuration agree.
- [ ] All four GitHub tools use authenticated transport.
- [ ] Strict project-link, public-repository, `main`-branch, size, pagination, and output-schema boundaries remain unchanged.
- [ ] Stable `RATE_LIMITED`, `NOT_FOUND`, `INVALID_INPUT`, and `INTERNAL_ERROR` envelopes remain unchanged.
- [ ] No portfolio API or database contract changes.

## Cache sweep

- [ ] Synthetic GitHub cache keys remain distinct from MCP POST requests.
- [ ] Repository, README, commit-list/reachability, and commit-detail TTLs match source constants.
- [ ] Only successful bounded responses are cached.
- [ ] Cache hits avoid GitHub calls.
- [ ] Cache failures and malformed entries remain misses.
- [ ] Stale-data expectations are documented.

## Traffic and quota sweep

- [ ] Installation quota assumptions cite current GitHub documentation.
- [ ] Shared installation quota is explicit; no per-user isolation is implied.
- [ ] Edge policy method/path/key/window/threshold/response/owner are recorded.
- [ ] Retry handling is bounded and header-aware.
- [ ] No load testing or high-volume probing is performed.
- [ ] A future threshold for repository-side synchronization is identified.

## Observability sweep

- [ ] Status, endpoint class, cache hit/miss, latency, refresh, and edge aggregates are available.
- [ ] Logs exclude secrets and document content.
- [ ] Alerts distinguish auth failure, GitHub rate limit, cache failure, and Worker failure.
- [ ] Correlation identifiers contain no secrets or token material.

## Documentation sweep

- [ ] This plan is linked from [[architecture/portfolio-mcp|the canonical MCP architecture note]].
- [ ] Stage statuses and `last_reviewed` values are current.
- [ ] Preparatory, approval-gated, deployed, and live claims are separated.
- [ ] Commands match current package scripts and Wrangler configuration.
- [ ] Version-sensitive references are primary and rechecked.

## Cost and capacity sweep

- [ ] Expected upstream call fan-out per GitHub tool is documented.
- [ ] Cache effectiveness is measured from safe aggregates after rollout.
- [ ] Installation quota headroom is reviewed before changing edge thresholds.
- [ ] Repository-side synchronization is considered before quota pressure becomes an incident.

## Milestone evidence

| Milestone | Required evidence | Status | Owner |
| --- | --- | --- | --- |
| M1 | App, installation, repository scope, and permissions review | planned | Operator-Syn |
| M2 | Secret contract and mocked token lifecycle tests | planned | Worker maintainer |
| M3 | Authenticated transport and four-tool regression tests | planned | Worker maintainer |
| M4 | Cache, rate mapping, bounded backoff, and edge policy review | planned | Worker/Cloudflare owner |
| M5 | Checks, dry run, deployment, smoke, monitoring, and rollback evidence | planned | Operator-Syn |

## Exception record

| Date | Sweep | Exception | Risk | Owner | Follow-up milestone |
| --- | --- | --- | --- | --- | --- |
| — | — | No exceptions recorded | — | — | — |
