---
title: Portfolio Agent Reliability Audit
aliases:
  - Portfolio assistant reliability audit
tags:
  - plan
  - audit
  - agents
  - mcp
role: project-plan-audit
status: complete
plan_id: portfolio-agent-reliability
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Portfolio Agent Reliability Audit

This note records the source-grounded baseline for the current three-sweep
reliability goal. It is an audit and decision record, not a second implementation
ledger. The navigation root is [[plans/portfolio-agent/README|the reliability
plan]], with the historical sequence in the [[plans/portfolio-agent/implementation-sweeps/README|implementation sweep index]].

## Scope and evidence

The audit covers MCP connection/discovery, preflight selection, quota admission,
model/stream outcomes, and the diagnostics needed to distinguish them. Source,
focused tests, typechecks, and the fixed repository profile establish local
behavior only. D1 migration application, Worker deployment, and authenticated
browser replay remain separate evidence boundaries.

The installed agent dependencies were inspected at agents 0.22.0 and
@cloudflare/ai-chat 0.11.0. The relevant source seams are
[the agent](../../../workers/portfolio-agent/src/agent.ts),
[the MCP helper](../../../workers/portfolio-agent/src/mcp.ts), and
[the quota helper](../../../workers/portfolio-agent/src/quota.ts).

## Baseline findings

- Startup recovery now makes three total attempts, with bounded backoff. A
  failed add/discovery can leave a server in connected, so recovery handles
  both failed and connected states.
- A restored connected transport can have an empty capability catalog. Removing
  and re-adding it is effective but unnecessarily invasive when direct
  discoverIfConnected can refresh the catalog in place.
- The SDK lifecycle wait and a second preflight wait were separate seams. A
  successful operation settled immediately, but a pending operation could pay
  two independent timeout budgets.
- The quota availability check runs before MCP grounding for known exhausted,
  paused, or unconfigured subjects. The final reservation still runs after
  evidence and prompt construction because concurrent turns and exact prompt
  size are not known earlier.
- Failure logging was mostly type-only strings. Without a typed event sequence,
  a blank response, a skipped MCP call, a provider failure, and a completed
  stream are difficult to distinguish from logs alone.

## Decisions

1. Preserve the stable MCP transport/session when catalog rediscovery can
   succeed; use remove/re-add only as a fallback. See
   [[plans/portfolio-agent/sweeps/31-non-destructive-mcp-rediscovery|Sweep 31]].
2. Disable the SDK's automatic lifecycle wait and make preflight own one
   60-second maximum discovery budget. Pass only the remaining budget to direct
   rediscovery and keep the existing bounded fallback. See
   [[plans/portfolio-agent/sweeps/32-shared-mcp-discovery-deadline|Sweep 32]].
3. Add redacted structured diagnostics at lifecycle boundaries without putting
   question text, MCP payloads, credentials, or provider secrets in events. See
   [[plans/portfolio-agent/sweeps/33-structured-diagnostics|Sweep 33]].

## Open limitations

The fixed local suite does not exercise a real restored SDK connection or an
authenticated deployed stream. The early quota check is an availability peek,
not a reservation; a concurrent turn can consume capacity before the final
reservation. Those are evidence and design boundaries, not reasons to add
unbounded retries or fixed sleeps.

Future circuit breakers, two-phase quota reservation, and user-controlled
context tools remain deferred in [[plans/portfolio-agent/deferred|Deferred
work]].
