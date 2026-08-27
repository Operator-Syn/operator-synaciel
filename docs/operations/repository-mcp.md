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

The tracked `.mcp.json` registration is shared by compatible project-scoped
clients. `.codex/config.toml` keeps Codex-specific tool approval policy. Both
registrations resolve the active Git root through
`scripts/mcp-launcher.mjs`; no checkout path is hardcoded. When a client
provides `CLAUDE_PROJECT_DIR`, the launcher uses it; otherwise it resolves the
root from the current Git directory.

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

- `app` covers application source, public assets, `.well-known/` metadata, and Vite entry files.
- `docs` covers the vault, `README.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, and `screenshot.png.md`.
- `mcp` covers the server, tests, scripts, hooks, MCP registrations, and
  tooling metadata, including `mcp:check` and `skills-lock.json`.
- `database` covers migrations, the Drizzle configuration, the database schema and seed, and Wrangler configuration.
- `config` covers ordinary project configuration and files under `.well-known/`, `.vscode/`, `docs/`, `mcp/`, `public/`, `scripts/`, `src/`, and `tests/`, plus the root Biome, Drizzle, HTML, and Vite configuration files.
  Database migrations and restricted tool directories retain their dedicated
  profiles and consent boundaries.
- `full` runs the complete fixed local check set.

Verification uses only repository-native npm scripts. The MCP never accepts
arbitrary shell commands, deployment, remote Git operations, Cloudflare
credentials, or local/remote D1 migration application.

## Setup

```bash
npm install
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
pipenv install --dev --deploy
pipenv run graphify update . --no-cluster
```

Use `repository_workflow_status` after setup to inspect the active root,
registrations, dependency readiness, Graphify output, vault index, and hooks.
The status tool is read-only and does not return secrets. A missing Graphify
output is an onboarding warning, not a reason to mutate the repository through
the MCP.

The local stdio servers require Git, Node/npm, Bash, and Pipenv on the existing
repository toolchain. A collaborator must trust or approve project-scoped MCP
servers in their client; that approval is intentionally not stored as a global
machine setting.

## Project-local Codex skills

Codex project skills live under `.agents/skills/` and are checked in with the
repository. Install the complete Matt Pocock bundle from the repository root:

```bash
npx skills@latest add mattpocock/skills \
  --agent codex \
  --copy \
  --yes
```

The command also records the upstream file set in `skills-lock.json`.
Review the resulting `.agents/` paths and lockfile through the repository MCP
because they are restricted developer tooling. Omit the global `-g` flag for
repository-only skills.

`npm run skills:check` validates the repository-owned skill bundles with the
strict Codex schema and the locked upstream bundle with its compatible
frontmatter and metadata rules.

## Git boundary

The versioned `.githooks/pre-commit` hook requires exactly one staged path.
Restricted `.codex/`, `.agents/`, and Obsidian configuration paths require
explicit MCP consent. The versioned `pre-push` hook rejects merge, empty, and
multi-path commits in the outgoing range.

Ignored runtime directories remain unwritable. A tracked deletion from one of
those directories may be reviewed and committed so generated state can be
cleaned from repository history without permitting new runtime writes.

Direct shell `git commit`, `--no-verify`, changing `core.hooksPath`, and
deleting the versioned hooks are unsupported bypasses. Push, deployment, and
database application remain separate user-authorized actions.

The repository does not install a generic filesystem writer or run an automatic
post-commit Graphify rebuild. Graphify state is ignored local output and is
updated explicitly with `pipenv run graphify update .`.

## Related notes

- [[operations/local-development|Local development]] - application, Graphify, and database commands.
- [[database/migrations|Database migrations]] - readable SQL review and apply workflow.
- [[obsidian|Obsidian vault and skills]] - native Obsidian skill installation.
