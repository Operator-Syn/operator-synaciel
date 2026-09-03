---
title: Repository MCP Reads Search and Permissions
aliases:
  - Bounded repository reads
  - MCP read permissions
tags:
  - mcp
  - reads
  - search
  - permissions
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/04-policy-profiles-and-path-safety|Path safety]]"
---

# Reads, Search, and Permissions

## Bounded source reads

`read_repository_files` validates 1–20 unique relative paths, checks the selected
profile and exact-path permissions, reads only regular text files up to 1 MiB,
and returns hashes plus pagination metadata. Offset mode uses a default
16,000-character chunk and a 64,000-character maximum. The aggregate response
is capped at 256,000 characters.

Line mode requires both 1-based inclusive `startLine` and `endLine`, accepts at
most 500 lines, and returns `nextLine` when the requested range exceeds the
chunk limit. Offset and line modes cannot be mixed. Missing allowed files return
`exists: false`, empty content, and a null hash.

## Literal search

`search_repository` enumerates Git-visible cached, dirty, and untracked files
with `git ls-files --cached --others --exclude-standard`. It performs literal,
case-sensitive or insensitive matching and returns path, line, column, bounded
preview, and file hash. It caps results at 200, candidate files at 5,000, query
length at 1,000 characters, preview lines at 512 characters, and accepted text
at 32 MiB. Continuation uses `offset` and `nextOffset` with
`SEARCH_LIMIT_REACHED`.

Search never executes the query and skips ignored, binary, sensitive, invalid
encoding, and credential-like content.

## Exact-path read permission

Focused profiles may deny otherwise safe paths. The permission flow is:

1. Report every denied path without reading its content.
2. Ask for explicit temporary or permanent scope.
3. Call `grant_repository_read_access` with `approve: true`.
4. For temporary scope, retry the read with the returned one-time token.
5. For permanent scope, store exact paths outside the checkout.

Temporary grants last 15 minutes, are hashed in memory, bounded to 100 grants,
and consumed after one successful read. Permanent allowlists are owner-readable,
checkout/profile-bound, atomic, capped at 200 paths per profile, and configured
outside the repository using `OPERATOR_SYNACIEL_MCP_READ_ALLOWLIST` or the
platform config directory. Read grants never widen write profiles.

## Failure recovery

Expected responses use `READ_PERMISSION_REQUIRED`, `PROFILE_DENIED`,
`LINE_RANGE_INVALID`, `LINE_TOO_LONG`, `CONTENT_GUARD_REJECTED`, or
`SEARCH_LIMIT_REACHED` with a retryable flag and next tool where appropriate.

Related:
[[univsersal-repository-mcp-structure/06-change-preparation-and-diff|prepare after reading]] ·
[[univsersal-repository-mcp-structure/10-errors-security-and-boundaries|error envelopes]]
