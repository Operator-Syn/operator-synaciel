---
title: Repository MCP Change Preparation and Diff
aliases:
  - Prepared repository changes
  - MCP review diff
tags:
  - mcp
  - changes
  - diff
  - hashes
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/07-apply-rollback-and-concurrency|Apply and rollback]]"
---

# Change Preparation and Diff

`prepare_repository_change` is the review boundary. It must not mutate the
checkout.

## Operation modes

| Mode | Required input | Behavior |
| --- | --- | --- |
| `write` | complete `content`; existing files require `expectedSha256` | replace/create a guarded text file |
| `edit` | existing hash plus exact `oldText`/`newText` replacements | apply each anchor exactly once against the captured snapshot |
| `delete` | existing tracked-file hash; no content/replacements | prepare a tracked regular-file deletion |

Writes reject unacknowledged content shortening. Edits reject missing,
ambiguous, or overlapping anchors. Deletes reject untracked, missing,
directory, symlink, ignored, binary, sensitive, oversized, and credential-like
targets.

## Review artifact

Preparation captures each current file state, computes final hashes and byte
counts, builds a deterministic `DiffDocument`, and returns:

- plan ID, one-time apply token, review hash, instance ID, and expiry;
- file summaries with old/new hashes and byte counts;
- bounded preview plus full character/byte totals, next offset, and omitted paths;
- selected verification profile and whether verification is required.

Diff storage is capped at 8,000,000 characters. The preview is capped at 16,000
characters; `read_repository_change_diff` retrieves authenticated chunks up to
64,000 characters.

## Relation graph

`repository-changes.ts` owns prepare/apply state and depends on `path.ts`,
`policy.ts`, `redaction.ts`, `text-edits.ts`, `diff.ts`, `verification.ts`,
`workflow-status.ts`, `mutation-lock.ts`, `errors.ts`, and
`commit-pipeline.ts`. The diff module measures UTF-8 bytes separately from
JavaScript character offsets so continuation metadata is explicit.

Related:
[[univsersal-repository-mcp-structure/07-apply-rollback-and-concurrency|apply next]] ·
[[univsersal-repository-mcp-structure/08-verification-and-status|verification]]
