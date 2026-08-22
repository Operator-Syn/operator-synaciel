---
title: Repository MCP and Commit Pipeline
tags:
  - operations
  - mcp
  - git
role: guide
---

# Repository MCP and Commit Pipeline

This repository provides the local `operator-synaciel-repository` MCP for
reviewable file changes, fixed verification, and guarded local commits. It is
separate from Graphify: Graphify retrieves code relationships, while this MCP
does not index code or update the graph.

## Workflow

Use the bounded flow for planned edits:

1. `prepare_repository_change`
2. Review the returned paths, hashes, and diff.
3. `apply_repository_change` with the exact token, hashes, and approval.
4. `verify_repository_change` with the narrowest profile.
5. `prepare_commits`, edit the subjects, then `git_commit_files`.

Use the complete dirty-tree flow when reviewing existing work:

1. `prepare_working_tree_commit`
2. Resolve any restricted-path consent challenge.
3. Review every dirty path, status, size, hash, and diff.
4. `git_commit_working_tree` with one reviewed subject per path.

The server rechecks status and content hashes immediately before each commit,
keeps the Git hooks active, and stops on the first failure. Partial progress is
returned instead of silently continuing.

## Profiles

- `app` covers application source, public assets, and Vite entry files.
- `docs` covers the vault, `README.md`, and `AGENTS.md`.
- `mcp` covers the server, tests, scripts, hooks, Codex configuration, and
  tooling metadata.
- `database` covers readable migration files and Wrangler configuration.
- `config` covers package, TypeScript, lint, Graphify, and ignore configuration.
- `full` runs the complete fixed local check set.

Verification uses only repository-native npm scripts. The MCP never accepts
arbitrary shell commands, deployment, remote Git operations, Cloudflare
credentials, or local/remote D1 migration application.

## Setup

```bash
npm install
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
```

Codex loads the project registration from `.codex/config.toml`. The launcher
resolves the active Git root at runtime so a relocated clone does not depend on
this checkout path.

## Git boundary

The versioned `.githooks/pre-commit` hook requires exactly one staged path.
Restricted `.codex/`, `.agents/`, and Obsidian configuration paths require
explicit MCP consent. The versioned `pre-push` hook rejects merge, empty, and
multi-path commits in the outgoing range.

Direct shell `git commit`, `--no-verify`, changing `core.hooksPath`, and
deleting the versioned hooks are unsupported bypasses. Push, deployment, and
database application remain separate user-authorized actions.

## Related notes

- [[operations/local-development|Local development]] - application, Graphify, and database commands.
- [[database/migrations|Database migrations]] - readable SQL review and apply workflow.
- [[obsidian|Obsidian vault and skills]] - native Obsidian skill installation.
