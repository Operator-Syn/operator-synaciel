---
title: Sweep 27 — eager MCP tool discovery before preflight
aliases:
  - Portfolio Agent Sweep 27
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

# Sweep 27 — eager MCP tool discovery before preflight

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-09-01
**Scope:** wait for the complete Portfolio MCP connection and discovered catalog
before preflight tool selection.

- [x] Increased the Agents SDK `waitForMcpConnections` timeout from 5 seconds
      to 60 seconds.
- [x] Added an explicit `mcp.waitForConnections` wait inside preflight before
      reading `getAITools()`, covering the direct tool-selection seam.
- [x] Kept `search_portfolio` as the grounding evidence gate; discovery does
      not trigger model work or expose GitHub tools outside explicit context.
- [x] Added regression coverage for the shared timeout and wait-before-catalog
      ordering.

The source and local checks establish eager discovery only. Persistent upstream
failure still uses the bounded evidence-unavailable response; deployment and
authenticated browser replay remain operator-authorized.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/26-remove-application-request-caps|Sweep 26 — remove application request caps]]
- Next: [[plans/portfolio-agent/implementation-sweeps/28-settle-rolling-quota-on-actual-model-usage|Sweep 28 — settle rolling quota on actual model usage]]
