---
title: Repository MCP Commit Pipeline and Hooks
aliases:
  - Guarded MCP commits
  - One-file commit pipeline
tags:
  - mcp
  - git
  - hooks
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/08-verification-and-status|Verification]]"
---

# Commit Pipeline and Hooks

The commit boundary is separate from change application and remains one reviewed
file per commit.

## Two operation paths

| Path | Preparation | Commit tools | Stored proof |
| --- | --- | --- | --- |
| Existing dirty tree | `prepare_working_tree_commit` | `git_commit_working_tree` | operation ID, snapshot hash, per-file hashes/diff |
| Applied MCP change | `prepare_repository_change` then apply | `prepare_commits` then `git_commit_files` | operation ID, approval hash, final hashes |

Both paths recheck the complete expected scope, reject unrelated changes,
validate one sentence subjects, preserve active hooks, stop on the first Git or
hook failure, and return partial progress rather than silently continuing.

## Restricted paths

`.agents`, `.codex`, `.impeccable`, and `.obsidian` require explicit consent.
A dirty-tree preparation returns a path/size challenge and one-time token. The
commit gate passes an internal marker to the versioned hook without exposing it
in MCP output. Read grants do not grant commit or write access.

## Hook topology

- `npm run setup:git-hooks` sets local `core.hooksPath` to `.githooks`.
- `.githooks/pre-commit` invokes `scripts/validate-commit.ts` and requires
  exactly one staged path.
- `.githooks/pre-push` invokes `scripts/audit-one-file-history.ts` and rejects
  merge, empty, or multi-path outgoing commits.
- `.codex/hooks/repository-commit-gate.mjs` denies direct shell Git commits.
- `.codex/hooks.json` loads session guidance, Graphify checks, documentation
  checks, Biome feedback, and the commit gate.
- PostToolUse feedback is advisory and cannot roll back a completed edit.

The repository does not provide a generic filesystem writer and does not
automatically rebuild Graphify after commits.

Related:
[[univsersal-repository-mcp-structure/10-errors-security-and-boundaries|security boundary]] ·
[[univsersal-repository-mcp-structure/12-sequential-checkpoints|checkpoint sequence]]
