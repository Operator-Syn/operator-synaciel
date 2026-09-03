---
title: Repository MCP Vocabulary and Configuration
aliases:
  - MCP blueprint vocabulary
tags:
  - mcp
  - blueprint
  - configuration
role: reference
status: blueprint
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/02-registration-and-bootstrap|Registration and bootstrap]]"
---

# Repository MCP Vocabulary and Configuration

Use these neutral names in reusable designs. Replace each placeholder through
one repository configuration mapping rather than spreading product names through
the implementation.

| Placeholder | Meaning | Current implementation mapping |
| --- | --- | --- |
| `{{SERVER_NAME}}` | MCP server identity | `operator-synaciel-repository` in `policy.ts` |
| `{{SERVER_VERSION}}` | protocol/tool-schema version | `2.0.0` in `policy.ts` |
| `{{SERVER_INSTRUCTIONS}}` | short client-facing safety instructions | `MCP_SERVER_INSTRUCTIONS` |
| `{{MCP_WORKSPACE}}` | server-owned source workspace | `tools/repository-mcp/` |
| `{{SERVER_ENTRYPOINT}}` | executable source entrypoint | `tools/repository-mcp/src/server.ts` |
| `{{SERVER_FACTORY}}` | testable server constructor | `createOperatorSynacielRepositoryServer` |
| `{{TOOL_REGISTRY}}` | registration seam | `registerRepositoryTools` |
| `{{TRANSPORT}}` | protocol transport | `StdioServerTransport` |
| `{{PROJECT_ROOT_ENV}}` | optional configured checkout root | `OPERATOR_SYNACIEL_MCP_ROOT` |
| `{{COMPILED_MODE_ENV}}` | source/compiled launcher switch | `OPERATOR_SYNACIEL_MCP_COMPILED` |
| `{{ROOT_SAFE_LAUNCHER}}` | clone-safe launcher | `scripts/mcp-launcher.mjs` |
| `{{CLIENT_REGISTRATION}}` | shared client manifest | `.mcp.json` |
| `{{CLIENT_POLICY}}` | client-specific approvals and tool allowlist | `.codex/config.toml` |
| `{{PROFILE_REGISTRY}}` | read/write path and byte policy | `REPOSITORY_WRITE_PROFILES` |
| `{{VERIFICATION_REGISTRY}}` | fixed safe checks | `REPOSITORY_VERIFICATION_PROFILES` and `SAFE_VERIFICATION_COMMANDS` |
| `{{READ_PERMISSION_STORE}}` | exact-path read grants | `createRepositoryReadPermissionStore` |
| `{{CHANGE_PLANNER}}` | hash-bound prepare/apply seam | `repository-changes.ts` |
| `{{COMMIT_PIPELINE}}` | reviewed commit seam | `commit-pipeline.ts` |
| `{{MUTATION_LOCK}}` | per-checkout serialization | `withMutationLock` |
| `{{ERROR_ENVELOPE}}` | stable failure metadata | `RepositoryDomainError` and `failureFields` |

## Configuration rules

- Resolve a canonical Git root at runtime; never hardcode a checkout path.
- Keep shared registration and client-specific approval policy separate.
- Keep the transport configurable, but document the security model for every
  transport. The current local implementation supports stdio only.
- Keep profiles, limits, verification commands, and sensitive-path rules in one
  policy seam that can be audited and tested.
- Keep repository-specific names in a mapping table, not in generic interfaces.
- Treat server version changes and input/output schema changes as reconnect
  boundaries for long-lived clients.

## Current implementation mapping

The current values are verified in
`tools/repository-mcp/src/policy.ts`, `src/server.ts`, and
`scripts/mcp-launcher.mjs`. The root-safe registration rules are enforced by
`scripts/check-mcp-config.mjs` and `tests/scripts/mcp-config.test.ts`.

Related implementation stages:
[[univsersal-repository-mcp-structure/02-registration-and-bootstrap|next: registration and bootstrap]] ·
[[univsersal-repository-mcp-structure/03-tool-registry-and-contracts|next: tool contracts]]
