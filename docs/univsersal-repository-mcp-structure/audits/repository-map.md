---
title: Repository MCP Implementation Map
aliases:
  - MCP module map
  - Repository MCP relations
tags:
  - audit
  - mcp
  - architecture
role: audit
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/audits/evidence-ledger|Evidence ledger]]"
---

# Repository MCP Implementation Map

This map records the current local MCP source seams and the relationships
confirmed by Graphify plus direct source inspection.

## Runtime and policy seams

| Module | Key functions/types | Relationships |
| --- | --- | --- |
| `src/server.ts` | `createOperatorSynacielRepositoryServer`, `main` | imports root validation, policy identity, and tool registry; connects stdio |
| `src/tools/repository.ts` | `registerRepositoryTools`, result/error wrappers, permission elicitation | imports every domain service and output schema |
| `src/policy.ts` | identity, limits, ignored/restricted/binary sets, write/verification profiles | consumed by nearly every boundary |
| `src/schemas.ts` | 13 output schemas and shared field schemas | consumed by registry; mirrors tool result shapes |
| `src/errors.ts` | reason codes, `RepositoryDomainError`, `failureFields` | consumed by change/read/search/registry failures |
| `src/instance.ts` | per-process instance UUID | included in status and change results |

## Filesystem and read seams

| Module | Key functions/types | Relationships |
| --- | --- | --- |
| `src/path.ts` | root discovery/validation, path normalization, safety, digest, atomic write | foundation for all filesystem consumers |
| `src/redaction.ts` | `isSensitiveFileName`, `isCredentialLikeContent` | called by path, read, search, change, commit |
| `src/repository-files.ts` | bounded reads, line ranges, profile denial, permission flow | consumes path, policy, permissions, redaction |
| `src/repository-search.ts` | Git-visible literal search and limits | consumes path, policy, redaction |
| `src/read-permissions.ts` | temporary grants and owner-only persistent allowlist | consumed by tool registry and reader |

## Change and concurrency seams

| Module | Key functions/types | Relationships |
| --- | --- | --- |
| `src/text-edits.ts` | exact anchor occurrence and replacement | consumed by change preparation |
| `src/diff.ts` | deterministic sections, byte/character totals, chunk readers | consumed by change and commit pipelines |
| `src/repository-changes.ts` | prepare/apply/diff/verify, plans and receipts | consumes all safety seams; registers applied commit operation |
| `src/mutation-lock.ts` | per-checkout lock acquisition/reclamation | wraps mutating apply and commit operations |
| `src/verification.ts` | fixed command runner, fingerprint cache | called by verify and optional apply verification |
| `src/workflow-status.ts` | readiness probes and cache | exposed by status tool; invalidated after mutations |

## Commit and repository workflow seams

| Module | Key functions/types | Relationships |
| --- | --- | --- |
| `src/commit-pipeline.ts` | dirty-tree capture/commit, applied-operation commit, status/hash checks | consumes path, diff, lock, policy, verification/status invalidation |
| `scripts/mcp-launcher.mjs` | root resolution, launch spec, source/compiled mode | called by both client registrations |
| `scripts/check-mcp-config.mjs` | registration/launcher/config/hook assertions | checked by `mcp_config_check` |
| `scripts/validate-commit.ts` | staged-path and restricted-path gate | called by pre-commit |
| `scripts/audit-one-file-history.ts` | outgoing one-file history audit | called by pre-push |
| `.codex/hooks/repository-commit-gate.mjs` | direct Git commit detection/deny | called by Codex PreToolUse |
| `.codex/hooks.json` | session, Graphify, docs, Biome, and commit hook topology | client-side workflow integration |

## Primary directed relations

`server.ts` → `tools/repository.ts` → domain services and schemas

`repository-changes.ts` → `diff.ts`, `text-edits.ts`, `path.ts`,
`redaction.ts`, `verification.ts`, `workflow-status.ts`,
`mutation-lock.ts`, `commit-pipeline.ts`

`commit-pipeline.ts` → Git status/diff/add/commit, versioned hooks, and status/cache
invalidation

`policy.ts` → path/read/search/change/verify/commit schemas and scripts

This map is a source index, not a claim that every helper is public. Update it
when a module or boundary moves.
