---
title: Repository MCP Policy Profiles and Path Safety
aliases:
  - MCP path safety
  - Repository MCP profiles
tags:
  - mcp
  - security
  - paths
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/05-read-search-and-permissions|Reads and permissions]]"
---

# Policy Profiles and Path Safety

`{{PROFILE_REGISTRY}}` is the single policy seam for path prefixes, file-count
limits, byte budgets, ignored runtime directories, restricted developer
directories, binary extensions, and verification profiles.

## Current profiles

| Profile | Intended scope | Files | Bytes |
| --- | --- | ---: | ---: |
| `app` | application workspace | 60 | 500,000 |
| `docs` | vault, root docs, product/design context | 50 | 400,000 |
| `mcp` | MCP source, workers, tests, scripts, hooks, docs, metadata | 80 | 1,000,000 |
| `database` | API migrations, schema, seed, Drizzle, Wrangler config | 30 | 300,000 |
| `config` | ordinary root/workspace configuration | 80 | 1,000,000 |
| `repository` | all current tracked workspace boundaries | 80 | 1,000,000 |

The exact prefix lists are source-owned by `REPOSITORY_WRITE_PROFILES` in
`tools/repository-mcp/src/policy.ts`. The broad `repository` profile must cover
tracked `apps/`, `workers/`, `tools/`, `tests/`, `scripts/`, `docs/`, workflows,
developer configuration, and root manifests while excluding generated runtime
state.

## Global limits

| Guard | Current value |
| --- | ---: |
| Prepared files per operation | 20 |
| Text file limit | 1,000,000 bytes |
| Diff preview | 16,000 characters |
| Diff chunk | 64,000 characters |
| Diff storage | 8,000,000 characters |
| Source-read default/chunk/aggregate | 16,000 / 64,000 / 256,000 characters |
| Retained review budget | 64 MiB |
| Verification checks per request | 20 |
| Plan and operation lifetime | 30 minutes |
| Status/root validation caches | 2 seconds / 5 seconds |

## Guard order

1. Normalize separators and reject empty, absolute, NUL, traversal, and Git
   pathspec-magic inputs.
2. Require the canonical Git root and reject paths escaping it.
3. Reject ignored runtime directories unless the operation explicitly permits a
   reviewed deletion path.
4. Reject symlinks, non-regular files, oversized files, binary extensions, and
   invalid text encodings.
5. Reject sensitive environment/credential names and credential-like content.
6. Apply the selected profile prefix and aggregate file/byte budget.
7. Require explicit hashes and approval for mutating operations.

Read permission never widens write permission. The `.env.example` filename is a
narrow safe-template exception, but content still passes the credential-like
guard.

Related:
[[univsersal-repository-mcp-structure/05-read-search-and-permissions|read safety]] ·
[[univsersal-repository-mcp-structure/06-change-preparation-and-diff|change safety]] ·
[[univsersal-repository-mcp-structure/10-errors-security-and-boundaries|security boundary]]
