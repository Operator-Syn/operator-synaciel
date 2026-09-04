---
title: Repository MCP Tests Maintenance and Drift Control
aliases:
  - MCP documentation drift
  - Repository MCP maintenance
tags:
  - mcp
  - tests
  - maintenance
role: guide
status: blueprint
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/12-sequential-checkpoints|Checkpoints]]"
---

# Tests, Maintenance, and Drift Control

## Existing evidence map

The current `npm run test:mcp` suite covers:

- protocol initialization, tool discovery, output schemas, structured/text results,
  status caching, profile boundaries, and outside-Git failure;
- natural search/read/edit flows, pagination, stale hashes, and retry recovery;
- path redaction, binary/ignored/sensitive files, permission grants, and allowlists;
- diff size/chunk integrity, exact edits, rollback, deletes, receipts, and locks;
- dirty-tree/applied-operation commits, restricted consent, hooks, and partial progress;
- fixed verification caching, clone-safe launcher/configuration, documentation, and
  commit-gate behavior.

## Source-to-note ownership

| Source boundary | Canonical notes to refresh |
| --- | --- |
| `server.ts`, `scripts/mcp-launcher.mjs`, `.mcp.json`, `.codex/config.toml` | [[univsersal-repository-mcp-structure/02-registration-and-bootstrap|registration]] |
| `tools/repository.ts`, `schemas.ts` | [[univsersal-repository-mcp-structure/03-tool-registry-and-contracts|registry and contracts]] |
| `policy.ts`, `path.ts`, `redaction.ts` | [[univsersal-repository-mcp-structure/01-vocabulary-and-configuration|vocabulary]] and [[univsersal-repository-mcp-structure/04-policy-profiles-and-path-safety|policy]] |
| `repository-files.ts`, `repository-search.ts`, `read-permissions.ts` | [[univsersal-repository-mcp-structure/05-read-search-and-permissions|reads and permissions]] |
| `repository-changes.ts`, `text-edits.ts`, `diff.ts` | [[univsersal-repository-mcp-structure/06-change-preparation-and-diff|change preparation]] |
| `mutation-lock.ts`, `commit-pipeline.ts` | [[univsersal-repository-mcp-structure/07-apply-rollback-and-concurrency|apply]] and [[univsersal-repository-mcp-structure/09-commit-pipeline-and-hooks|commits]] |
| `verification.ts`, `workflow-status.ts` | [[univsersal-repository-mcp-structure/08-verification-and-status|verification]] |
| `errors.ts`, hooks, and commit scripts | [[univsersal-repository-mcp-structure/10-errors-security-and-boundaries|security]] |
| tests and Graphify output | [[univsersal-repository-mcp-structure/audits/evidence-ledger|evidence ledger]] |

## Drift guard

`tests/scripts/repository-mcp-blueprint.test.ts` derives the current registered
tool names, server identity, profile keys, verification profiles, and local
source-module list, then requires each to be represented in this blueprint. It
also checks the universal placeholder vocabulary and the explicit local/public
boundary. A new module, tool, profile, limit, or source seam must update the
nearest note and the evidence ledger in the same change.

## Maintenance procedure

1. Query Graphify narrowly, then confirm cited source and consumers.
2. Refresh the evidence ledger and mark the claim status.
3. Update the nearest canonical note and incoming/outgoing links.
4. Update the sequential checkpoint if implementation order or a gate changed.
5. Run `npm run docs:check`, `npm run mcp:typecheck`, and `npm run test:mcp`.
6. Run the matching full fixed profile before any guarded commit.

Related:
[[univsersal-repository-mcp-structure/audits/evidence-ledger|evidence ledger]] ·
[[univsersal-repository-mcp-structure/audits/unresolved-questions|unresolved questions]]
