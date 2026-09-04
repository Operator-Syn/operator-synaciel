---
title: Repository MCP Tool Registry and Contracts
aliases:
  - MCP tool registry
  - Repository MCP tools
tags:
  - mcp
  - tools
  - schemas
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/10-errors-security-and-boundaries|Errors and security]]"
---

# Tool Registry and Contracts

The registry should remain the only place that wires protocol names to domain
functions and output schemas. The current registry is
`tools/repository-mcp/src/tools/repository.ts`.

## Registration order and responsibilities

| Order | Tool | Responsibility |
| ---: | --- | --- |
| 1 | `repository_workflow_status` | root, tooling, Graphify, hooks, and capability readiness |
| 2 | `search_repository` | bounded literal search over visible profile files |
| 3 | `read_repository_files` | bounded source snapshots by offset or line range |
| 4 | `grant_repository_read_access` | approval-gated exact-path temporary/permanent read grant |
| 5 | `prepare_repository_change` | prepare write, exact edit, or tracked delete |
| 6 | `apply_repository_change` | explicit approved hash-checked apply and rollback |
| 7 | `verify_repository_change` | fixed verification profile execution |
| 8 | `read_repository_change_diff` | paginated prepared-change diff |
| 9 | `prepare_working_tree_commit` | snapshot dirty tree and request restricted-path consent |
| 10 | `read_working_tree_diff` | paginated dirty-tree diff |
| 11 | `git_commit_working_tree` | commit the reviewed dirty tree one path at a time |
| 12 | `prepare_commits` | suggest subjects for an applied operation |
| 13 | `git_commit_files` | commit an applied operation one path at a time |

The current `LOCAL_ONLY_MCP_TOOLS` set in `policy.ts` must remain equal to this
registry. A new tool requires a focused registrar, schema, test, and blueprint
mapping.

## Contract shape

- Inputs use Zod schemas with bounded strings, arrays, offsets, hashes, profiles,
  and explicit approvals.
- Outputs use strict Zod schemas in `schemas.ts`.
- Successful calls return the same canonical object in `structuredContent` and
  one compact, single-line human summary in a text content block.
- Domain failures include `status`, `auditId`, `message`, `reasonCode`,
  `retryable`, and optional `nextAction` or hash conflicts.
- Schema-validation failures remain protocol errors.
- The local server exposes tools only; it registers no resources.

## Relation graph

`registerRepositoryTools` depends on policy registries, output schemas, the
read/search services, change preparation/apply, verification, workflow status,
permission storage, and both commit paths. Domain modules do not construct the
MCP server or transport themselves.

Related:
[[univsersal-repository-mcp-structure/04-policy-profiles-and-path-safety|policy and path safety]] ·
[[univsersal-repository-mcp-structure/05-read-search-and-permissions|read/search services]] ·
[[univsersal-repository-mcp-structure/06-change-preparation-and-diff|change preparation]]
