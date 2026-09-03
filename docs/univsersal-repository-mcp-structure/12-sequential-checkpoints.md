---
title: Sequential Repository MCP Implementation Checkpoints
aliases:
  - Luna MCP implementation sequence
  - MCP blueprint stages
tags:
  - mcp
  - blueprint
  - checkpoints
role: project-plan
status: blueprint
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/11-tests-maintenance-and-drift|Maintenance]]"
---

# Sequential Implementation Checkpoints

Luna should complete these gates in order. A later stage must not be marked
complete from an earlier stage's evidence.

| # | Stage | Depends on | Exit gate |
| ---: | --- | --- | --- |
| 1 | Root and identity | — | canonical Git root, configurable identity, and fail-closed path boundary |
| 2 | Registration and launcher | 1 | relocated checkout launches through shared/client config without hardcoded paths |
| 3 | Bootstrap and transport | 2 | initialize handshake succeeds and stdout contains protocol only |
| 4 | Policy registry | 1 | profiles, limits, ignored/binary/restricted sets, and fixed commands are centralized |
| 5 | Tool registry and schemas | 3, 4 | every tool has bounded input, strict output schema, annotation, and test |
| 6 | Reads, search, permissions | 4, 5 | allowed/denied paths, pagination, grants, and recovery cases pass |
| 7 | Prepare and diff | 4, 5, 6 | write/edit/delete plans are hash-bound and reviewable without mutation |
| 8 | Apply, rollback, lock | 7 | stale plans conflict, writes are atomic, deletes quarantine, failures restore |
| 9 | Verification and status | 4, 5, 7 | only fixed checks run; cache/status semantics are observable |
| 10 | Commit pipeline and hooks | 8, 9 | exact reviewed scope commits one file at a time with active hooks |
| 11 | Contract and safety tests | 5–10 | protocol, failure, concurrency, redaction, and drift tests pass |
| 12 | Documentation handoff | 1–11 | links/evidence are current; no deployment/live claim is implied |

## Per-stage implementation rule

For each stage, record:

- input source/configuration and the focused note that owns the concept;
- interface or schema introduced;
- success and rejection/failure cases;
- exact command or test used as the checkpoint;
- evidence status and next-stage dependency.

## Suggested command gates

- Stages 1–3: `npm run mcp:check` and protocol/launcher tests.
- Stages 4–8: focused repository-MCP tests and `npm run mcp:typecheck`.
- Stage 9: `verify_repository_change` with the matching fixed profile.
- Stage 10: real versioned Git hooks in a disposable checkout.
- Stage 11: `npm run test:mcp` and the source-driven blueprint drift test.
- Stage 12: `npm run docs:check`, `npm run skills:check`, and `git diff --check`.

Deployment, migration application, push, and live-service verification are
separate approval-gated activities and are not checkpoint requirements.

Related:
[[univsersal-repository-mcp-structure/01-vocabulary-and-configuration|stage 1]] ·
[[univsersal-repository-mcp-structure/02-registration-and-bootstrap|stage 2]] ·
[[univsersal-repository-mcp-structure/03-tool-registry-and-contracts|stage 5]] ·
[[univsersal-repository-mcp-structure/09-commit-pipeline-and-hooks|stage 10]]
