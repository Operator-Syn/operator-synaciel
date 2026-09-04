---
title: Repository MCP Unresolved Questions
aliases:
  - MCP audit gaps
tags:
  - audit
  - mcp
  - uncertainty
role: audit
status: open
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/audits/evidence-ledger|Evidence ledger]]"
---

# Unresolved Questions

These are intentionally visible gaps, not implied failures.

| Question | Status | Why it remains open | Safe follow-up |
| --- | --- | --- | --- |
| Which external MCP clients support the complete structured output and elicitation flow? | unknown | tests use a local JSON-RPC client; no client matrix is part of this repository | run bounded handshake/tool-list/call checks per approved client |
| Does a future alternate transport preserve the local trust boundary? | unknown | current implementation is stdio-only | document a separate transport threat model before adding one |
| What deployment or hosted behavior exists for a repository MCP? | not applicable/current scope | this server has no deployment path or public endpoint | keep deployment outside this blueprint unless a new server explicitly adds it |
| Do profile prefixes fit another repository without adaptation? | assumption | profiles are intentionally repository-specific mappings | replace prefixes and budgets through the policy registry |
| Are all future source additions documented immediately? | guarded | source-driven blueprint test catches drift after implementation | update the nearest note in the same change |

No load testing, remote deployment, database migration, push, or credential
inspection was performed for this local-only audit.
