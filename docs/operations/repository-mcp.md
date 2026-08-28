---
title: Local Repository MCP (stdio) and Commit Pipeline
tags:
  - operations
  - mcp
  - git
role: guide
---

# Local Repository MCP (stdio) and Commit Pipeline

> Scope: this note documents the local repository-only MCP. It is launched as a
> stdio subprocess and has no public HTTP endpoint, portfolio tools, or
> portfolio resources. For the separate remote service, see [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]].

The local `operator-synaciel-repository` MCP is implemented in the
`tools/repository-mcp/` workspace. It provides reviewable file changes, fixed
verification, and guarded local commits through `StdioServerTransport`. It
operates on the checked-out Git repository and is separate from the public
`workers/portfolio-mcp/` Worker and from Graphify.

The tracked `.mcp.json` registration is shared by compatible project-scoped
clients. `.codex/config.toml` keeps Codex-specific tool approval policy. Both
registrations use the root-safe `scripts/mcp-launcher.mjs`; no checkout path is
hardcoded. When a client provides `CLAUDE_PROJECT_DIR`, the launcher uses it;
otherwise it resolves the root from the current Git directory.

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
keeps the Git hooks active, and stops on the first failure. Partial progress
is returned instead of silently continuing.

For `prepare_repository_change`, each operation must contain the complete
replacement content for its target text file. Do not use bounded terminal output
as the replacement payload. To catch accidental truncation before any write, a
shorter replacement for an existing file is rejected by default with a request
to set `allowContentShortening: true`. Use that opt-in only after reviewing the
complete diff for an intentional reduction. The apply step rechecks hashes,
writes atomically, verifies final hashes, and rolls back earlier writes when a
later write fails.

## Codex PostToolUse feedback

The repository-local `.codex/hooks.json` runs
`scripts/check-biome-hook.mjs` synchronously after `apply_patch`, `Edit`, and
`Write` operations and after the repository MCP's
`apply_repository_change`. The hook invokes
`npm run check:biome:github`. A passing check is silent. A failing check emits
model-visible `hookSpecificOutput.additionalContext` with bounded GitHub-format
diagnostics and asks the agent to fix them and rerun the check before continuing.
The operation already completed; this feedback does not roll it back or
auto-format files.

This is separate from the versioned `.githooks/pre-commit` hook. The Git hook
enforces commit policy at commit time; the Codex hook provides immediate
feedback during an agent turn. It does not run for arbitrary shell commands,
so manual shell writes should be followed by the explicit Biome command.

## Tool output contracts

All eight repository MCP tools advertise a native `outputSchema` in
`tools/list`. Successful calls return the canonical object in
`structuredContent` and retain a pretty-printed JSON text block for clients
that still consume text content. The schemas describe the existing status
unions rather than changing the guarded workflow behavior.

The output families are:

- `repository_workflow_status` returns readiness, tooling, Git hook, and
  capability status.
- `prepare_repository_change` returns either a prepared plan with hashes and
  an apply token or a rejected result.
- `apply_repository_change` returns an applied result, verification-failure
  result, conflict, or failed result.
- `verify_repository_change` returns a verification summary or rejection.
- `prepare_working_tree_commit` returns either a restricted-path consent
  challenge or a prepared snapshot.
- `git_commit_working_tree` and `git_commit_files` return committed or
  partial-commit results; `prepare_commits` returns bounded commit entries.
- Errors raised before a result is constructed remain MCP errors; returned
  result statuses remain structured and text-compatible.

`outputSchema` is a tool contract. This local repository MCP exposes no
resources, so there is no resource output schema to advertise.

## Profiles

- `app` covers `apps/portfolio-web/` application files.
- `docs` covers the vault, root documentation, and design context.
- `mcp` covers `tools/repository-mcp/`, `workers/portfolio-mcp/`, tests,
  scripts, hooks, MCP registrations, and tooling metadata.
- `database` covers `workers/portfolio-api/` migrations, schema, seed,
  Drizzle configuration, and API Wrangler configuration.
- `config` covers ordinary root and workspace configuration while keeping
  database artifacts on the dedicated database profile.
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

The local stdio server requires Git, Node/npm, Bash, and the existing
repository toolchain. A collaborator must trust or approve project-scoped MCP
servers in their client; that approval is intentionally not stored as a global
machine setting.

## Git boundary

The versioned `.githooks/pre-commit` hook requires exactly one staged path.
Restricted `.codex/`, `.agents/`, and Obsidian configuration paths require
explicit MCP consent. The versioned `pre-push` hook rejects merge, empty, and
multi-path commits in the outgoing range.

Direct shell `git commit`, `--no-verify`, changing `core.hooksPath`, and
deleting the versioned hooks are unsupported bypasses. Push, deployment, and
database application remain separate user-authorized actions.

The repository does not install a generic filesystem writer or run an
automatic post-commit Graphify rebuild. Graphify state is ignored local output
and is updated explicitly with `pipenv run graphify update .`.

## Related notes

- [[architecture/repository-layout|Repository layout]] - workspace ownership and root discovery files.
- [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] - the separate public read-only service.
- [[operations/local-development|Local development]] - workspace commands and deployment boundaries.
- [[database/migrations|Database migrations]] - readable SQL review and apply workflow.
- [[obsidian|Obsidian vault and skills]] - native Obsidian skill installation.
