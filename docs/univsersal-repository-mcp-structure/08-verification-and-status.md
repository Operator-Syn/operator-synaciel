---
title: Repository MCP Verification and Status
aliases:
  - MCP fixed verification
  - Workflow readiness status
tags:
  - mcp
  - verification
  - status
role: reference
status: verified-repository
last_verified: 2026-09-03
source_scope: "revision 6f4112b3fc5801e3298c80876c43cbbf0af8428e"
related:
  - "[[univsersal-repository-mcp-structure|Blueprint index]]"
  - "[[univsersal-repository-mcp-structure/07-apply-rollback-and-concurrency|Apply and rollback]]"
---

# Verification and Status

## Fixed command registry

Verification is allowlisted, non-shell, and repository-native. The current
`SAFE_VERIFICATION_COMMANDS` maps checks to npm invocations:

```text
mcp_config_check       -> npm run mcp:check
mcp_typecheck          -> npm run mcp:typecheck
mcp_test               -> npm run test:mcp
portfolio_mcp_typecheck -> npm run mcp:portfolio:check
portfolio_mcp_test      -> npm run test:portfolio-mcp
docs_check              -> npm run docs:check
skills_check            -> npm run skills:check
api_typecheck/api_test  -> workspace API checks
web_test                -> workspace web tests
db_migration_check      -> npm run db:migration:check
migration_list_local    -> npm run db:migrations:list:local
typecheck/lint/biome_check/build -> root npm checks
```

The MCP never accepts arbitrary commands, deploys, pushes, reads credentials,
or applies migrations.

## Verification profiles

- `mcp-fast`: configuration and local MCP typecheck.
- `mcp`: local/public MCP checks, tests, documentation, skills, lint, and Biome.
- `repository` and `full`: complete fixed repository checks, including API,
  web, migration validation/listing, root typecheck, lint, Biome, and build.
- `app`, `docs`, `database`, and `config`: bounded subsystem profiles.

`runVerificationProfile` fingerprints Git HEAD, status, and dependency lock
metadata. Successful results are cached for 30 seconds and invalidated after
applies/commits. Output is capped at 12,000 characters and execution stops at
the first failed check.

## Workflow status

`repository_workflow_status` reports the canonical root, server identity,
required file readiness, npm/tsx/Pipenv/Graphify availability, Git hook state,
profiles, warnings, timestamp, and cache hit. It returns `blocked` for an invalid
root, `attention` for warnings, and `ready` when all requirements pass. Status
results cache for two seconds; root validation caches for five seconds.

Related:
[[univsersal-repository-mcp-structure/09-commit-pipeline-and-hooks|commit hooks]] ·
[[univsersal-repository-mcp-structure/11-tests-maintenance-and-drift|verification maintenance]]
