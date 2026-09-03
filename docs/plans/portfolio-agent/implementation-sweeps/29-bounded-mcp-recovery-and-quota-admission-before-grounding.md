---
title: Sweep 29 — bounded MCP recovery and quota admission before grounding
aliases:
  - Portfolio Agent Sweep 29
tags:
  - plan
  - agents
  - verification
role: project-plan-sweep
status: complete
plan_id: portfolio-agent-public-assistant
owner: Operator-Syn
last_reviewed: 2026-09-01
risk: high
---

# Sweep 29 — bounded MCP recovery and quota admission before grounding

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-09-01
**Scope:** startup retry semantics, discovery-failure state handling, and
rolling-quota ordering relative to MCP preflight.

- [x] Re-audited the installed Agents SDK source and current Cloudflare client
      contract. The persisted retry option counts total attempts; the initial
      `addMcpServer` connection/discovery call is direct, so the agent now uses
      three total startup attempts (initial plus two recoveries) with bounded
      exponential backoff.
- [x] Recovery removes both `failed` and `connected` portfolio server states.
      The latter matters because a transport can remain connected when tool
      discovery fails. Missing state or cleanup errors stop recovery without
      aborting the Durable Object handshake.
- [x] If preflight still sees no `search_portfolio` after the discovery wait,
      it forces one reconnect through the same bounded helper before returning
      the evidence-unavailable fallback.
- [x] Added a quota-availability check after identity/question/safety gates and
      before `search_portfolio`. Known rolling exhaustion, administrator pause,
      and missing quota configuration now return the existing warning without
      spending an MCP call. The final conditional D1 reservation remains after
      evidence and prompt construction for exact sizing and concurrent-turn
      races.
- [x] Added regression coverage for three-attempt recovery, connected-state
      discovery cleanup, preflight ordering, and exhausted-window admission.
- [x] Focused portfolio-agent tests pass; repository MCP fast verification
      passes after the guarded apply and formatter correction.

The early quota check intentionally cannot guarantee that every later
quota-rejected turn avoids MCP: another concurrent turn may consume the
remaining capacity, or the exact post-grounding prompt estimate may exceed the
remaining tokens. A preflight-free exact guarantee would require reserving a
conservative provisional amount before grounding and releasing or settling it
when the final prompt is known; that adds reservation lifecycle and stranded
capacity complexity. A larger retry budget or fixed 60-second sleeps would
increase startup latency and upstream load without improving the bounded
failure contract, so they remain out of scope. A future health/circuit-breaker
layer could suppress repeated recovery during a sustained outage, but would need
durable state and live failure-rate evidence before adoption.

Deployment, migration application, and authenticated browser/WebSocket replay
remain separate operator-authorized checks.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/28-settle-rolling-quota-on-actual-model-usage|Sweep 28 — settle rolling quota on actual model usage]]
- Continues in: [[plans/portfolio-agent/sweeps/31-non-destructive-mcp-rediscovery|Sweep 31 — non-destructive catalog rediscovery]]
