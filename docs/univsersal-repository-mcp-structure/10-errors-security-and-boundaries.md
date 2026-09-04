---
title: Repository MCP Errors Security and Boundaries
aliases:
  - MCP failure envelopes
  - Repository MCP security model
tags:
  - mcp
  - security
  - errors
role: explanation
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/04-policy-profiles-and-path-safety|Path safety]]"
---

# Errors, Security, and Boundaries

## Stable failure vocabulary

The current reason codes in `errors.ts` are:

```text
PROFILE_DENIED
READ_PERMISSION_REQUIRED
HASH_MISMATCH
PLAN_UNAVAILABLE
REVIEW_HASH_MISMATCH
ANCHOR_NOT_FOUND
AMBIGUOUS_EDIT
OVERLAPPING_EDIT
CONTENT_GUARD_REJECTED
LINE_RANGE_INVALID
LINE_TOO_LONG
SEARCH_LIMIT_REACHED
VERIFICATION_FAILED
APPLY_ROLLED_BACK
INVALID_REQUEST
INTERNAL_ERROR
```

Each error should explain the failed boundary, whether retry is safe, and the
next tool when a deterministic recovery exists. Hash conflicts include expected
and current hashes. Never expose approval markers, permission tokens, credentials,
private keys, or full sensitive content.

## Trust boundaries

- Client to MCP: validate every input with bounded schemas.
- MCP to filesystem: canonical-root, regular-file, symlink, size, encoding, and
  redaction guards.
- MCP to Git: use fixed argument arrays, no shell execution, status/hash
  rechecks, and active hooks.
- MCP to verification: execute only the fixed command registry.
- MCP to user approval: keep read permission, change apply, restricted commit,
  and deployment consent separate.
- MCP to documentation: source/config/test evidence is local; deployment and
  live behavior are distinct evidence surfaces.

The local server must not deploy, push, apply migrations, access Cloudflare
credentials, accept arbitrary shell commands, or expose public HTTP behavior.

## Recovery taxonomy

- Retry with a fresh read after `HASH_MISMATCH`.
- Reprepare after `PLAN_UNAVAILABLE` or expiry.
- Repair the anchor after `ANCHOR_NOT_FOUND`, `AMBIGUOUS_EDIT`, or
  `OVERLAPPING_EDIT`.
- Split a request after size/retention or search-limit failures.
- Treat `VERIFICATION_FAILED` as applied-but-not-verified, not as automatic
  rollback.
- Treat `APPLY_ROLLED_BACK` as no intended change remaining, then reprepare.

Related:
[[univsersal-repository-mcp-structure/11-tests-maintenance-and-drift|test these boundaries]] ·
[[univsersal-repository-mcp-structure/12-sequential-checkpoints|implement in order]]
