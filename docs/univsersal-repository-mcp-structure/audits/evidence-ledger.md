---
title: Repository MCP Evidence Ledger
aliases:
  - MCP audit ledger
tags:
  - audit
  - evidence
  - mcp
role: audit
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/audits/repository-map|Repository map]]"
---

# Repository MCP Evidence Ledger

| Claim/boundary | Evidence | Observation | Status/confidence | Documentation impact |
| --- | --- | --- | --- | --- |
| Server is local stdio | `src/server.ts` and protocol tests | connects `StdioServerTransport`; 13 tools initialize | verified-repository / high | bootstrap, registry |
| Root is canonical Git checkout | `src/path.ts`, launcher, launcher tests | rejects outside Git, symlink root, and mismatched Git root | verified-repository / high | registration, path safety |
| Registration is clone-safe | `.mcp.json`, `.codex/config.toml`, `mcp-launcher.mjs`, config tests | resolves root at runtime; no machine-specific path | verified-repository / high | bootstrap |
| Profiles bound reads/writes | `policy.ts`, profile tests | six profiles with bounded prefixes/files/bytes | verified-repository / high | vocabulary, policy |
| Source reads/search are bounded | reader/search modules and natural-editing tests | offsets/lines, hashes, result limits, continuation metadata | verified-repository / high | reads/search |
| Read grants are separate | `read-permissions.ts` and permission tests | temporary one-time token or persistent external allowlist | verified-repository / high | permissions/security |
| Changes are reviewable | `repository-changes.ts`, diff/text-edit tests | hash-bound write/edit/delete and authenticated diff chunks | verified-repository / high | change preparation |
| Apply is atomic and recoverable | change/rollback tests and mutation lock | lock, tombstones, final hash check, reverse rollback, receipt | verified-repository / high | apply/concurrency |
| Verification is fixed | `verification.ts` and verification tests | allowlisted npm commands, fingerprinted 30-second success cache | verified-repository / high | verification/status |
| Commits remain one-file | commit pipeline, hook scripts, commit tests | exact reviewed scope, one sentence subject, active pre-commit/pre-push | verified-repository / high | commit pipeline |
| Docs are maintained as a vault | `docs/README.md`, docs checker, documentation tests | root MOC and meaningful wikilinks; current local/public boundary | verified-repository / high | all notes |
| No deployment/live proof | local-only source and checks | no public endpoint or deployment operation exists for this server | verified-repository / high | unresolved questions |

## Verification record

- `repository_workflow_status`: `ready`, hooks active, Graphify and tooling present.
- `npm run mcp:check`: passed.
- `npm run mcp:typecheck`: passed.
- `npm run test:mcp`: 90 tests passed after adding the blueprint drift guard.
- `npm run docs:check`: passed.
- `npm run skills:check`: passed.
- `git diff --check`: passed before this documentation change.

The last item must be rerun after applying the blueprint. Source and local tests
do not establish deployment, remote client compatibility, or capacity.
