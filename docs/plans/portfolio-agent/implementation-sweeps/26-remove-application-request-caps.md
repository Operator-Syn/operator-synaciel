---
title: Sweep 26 — remove application request caps
aliases:
  - Portfolio Agent Sweep 26
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

# Sweep 26 — remove application request caps

Back to [[plans/portfolio-agent/implementation-sweeps/README|the implementation sweep index]].

**Date:** 2026-09-01
**Scope:** remove application-level pass, MCP-call, output, question-length,
and message-storage caps while retaining the rolling quota and external provider
boundaries.

- [x] Removed the 10-pass stop condition and 20-call MCP wrapper; the model loop
      now stops naturally when it no longer requests tools.
- [x] Removed the fixed 700-token output cap, 2,000-character agent/input cap,
      200-message persistence override, and explicit `limit: 8` preflight value.
- [x] Removed the explicit `maxRetries: 0` override so the AI SDK default applies.
- [x] Kept the 1,000,000 estimated-token/30-minute subject quota, MCP grounding
      preflight, stream coalescing safeguard, and existing provider/MCP schema
      validation and runtime timeouts.
- [x] Added regression coverage proving the removed application caps are absent
      and prompt estimation no longer adds a fixed output allowance.

Full-thread mode can reach provider, MCP-schema, or account-capacity limits; those
failures use the existing bounded error/retry paths. Source and local checks are
verified; deployment and authenticated browser replay remain operator-authorized.

## Related sweeps

- Previous: [[plans/portfolio-agent/implementation-sweeps/25-full-thread-context-mode|Sweep 25 — full-thread context mode]]
- Next: [[plans/portfolio-agent/implementation-sweeps/27-eager-mcp-tool-discovery-before-preflight|Sweep 27 — eager MCP tool discovery before preflight]]
