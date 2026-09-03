---
title: Sweep 31 — Non-destructive MCP catalog rediscovery
aliases:
  - Portfolio Agent Sweep 31
tags:
  - plan
  - agents
  - mcp
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Sweep 31 — Non-destructive MCP catalog rediscovery

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]],
[[plans/portfolio-agent/README|the reliability plan]], or
[[plans/portfolio-agent/audit|the audit]].
The preceding historical recovery and quota work is
[[plans/portfolio-agent/implementation-sweeps/29-bounded-mcp-recovery-and-quota-admission-before-grounding|Sweep 29]].

## Objective

When the Portfolio MCP transport is still connected but its discovered catalog
is empty, refresh capabilities in place before deleting the persisted server
row or transport session.

## Implementation

- The agent's manager seam now exposes the SDK's direct
  discoverIfConnected operation with an optional timeout.
- Preflight calls rediscovery for connected or ready Portfolio MCP servers when
  search_portfolio is missing.
- Successful rediscovery preserves the existing server ID/session and proceeds
  to normal evidence grounding.
- Only a failed rediscovery, missing connection, or cleanup failure reaches the
  existing bounded remove/re-add recovery path.

## Evidence and gate

Focused lifecycle coverage proves that successful rediscovery does not call
remove, while failed rediscovery leaves the reconnect fallback available.
The portfolio-agent tests, typecheck, Biome check, and fixed MCP-fast profile
passed locally.

No migration, deployment, or authenticated live replay was performed. See the
[[architecture/portfolio-agent|Portfolio Assistant Agent architecture]] for
the runtime contract and [[plans/portfolio-agent/sweeps/32-shared-mcp-discovery-deadline|Sweep 32]]
for the next timing change.
