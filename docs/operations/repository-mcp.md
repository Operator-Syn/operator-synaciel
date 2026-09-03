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
>
> The reusable, repository-agnostic implementation blueprint is [[univsersal-repository-mcp-structure|Universal Repository MCP Structure Blueprint]].

The local `operator-synaciel-repository` MCP is implemented in the
`tools/repository-mcp/` workspace. It provides reviewable file changes, fixed
verification, and guarded local commits through `StdioServerTransport`. It
operates on the checked-out Git repository and is separate from the public
`workers/portfolio-mcp/` Worker and from Graphify.

The current local protocol is version 2.0.0. Long-lived clients must reconnect
after a server or tool-schema version change.

The tracked `.mcp.json` registration is shared by compatible project-scoped
clients. `.codex/config.toml` keeps Codex-specific tool approval policy. Both
registrations use the root-safe `scripts/mcp-launcher.mjs`; no checkout path is
hardcoded. When a client provides `CLAUDE_PROJECT_DIR`, the launcher uses it;
otherwise it resolves the root from the current Git directory.

## Workflow

Start every change with `repository_workflow_status`. For codebase questions,
query Graphify narrowly and then confirm the cited source directly, for example:

```bash
pipenv run graphify query "<focused question>" \
  --context-filter "tools/repository-mcp,tests,docs/operations/repository-mcp.md" \
  --depth 2 --budget 2_500
```

For repeated MCP iterations, use the cached `mcp-fast` verification profile after each bounded apply. It checks the fixed MCP configuration and typecheck commands; run the complete matching profile before committing.

Use the bounded flow for planned edits:

1. Use `search_repository` and `read_repository_files` to locate the exact
   source. Reads support character offsets and inclusive line ranges.
2. Call `prepare_repository_change` with a complete `write`, an exact anchored
   `edit`, or `action: "delete"` plus the current hash. Keep the smallest
   practical file set.
3. Review every returned path, old hash, new hash, byte count, profile, and
   bounded diff preview. When `diffTruncated` is true, read all chunks with
   `read_repository_change_diff` before applying.
4. `apply_repository_change` with `planId`, `applyToken`, `reviewHash`, and
   explicit approval. The server rechecks every current file hash.
5. Run `verify_repository_change` explicitly with the returned matching profile;
   do not prepare or commit subjects until the required checks pass. An apply
   response may include a passing optional verification summary, but an absent
   or failing summary leaves `verificationRequired` true.
6. `prepare_commits`, edit the subjects, then `git_commit_files`.

Use the complete dirty-tree flow when reviewing existing work:

1. `prepare_working_tree_commit` directly.
2. Resolve any restricted-path consent challenge.
3. Review every dirty path, status, size, hash, and bounded diff preview. When
   `diffTruncated` is true, read all chunks with `read_working_tree_diff`.
4. Run `mcp-fast` while iterating when only MCP wiring/type safety needs a quick check; run the complete matching profile returned by preparation before committing.
5. `git_commit_working_tree` with one reviewed subject per path.

`prepare_commits` is intentionally limited to an operation returned by
`apply_repository_change`; it is not the dirty-tree preparation tool.
For a deletion, `git_commit_files` rechecks that the reviewed path remains
absent and stages it with `git add -u` before invoking the one-file hook gate.

The server rechecks status and content hashes immediately before each commit,
keeps the Git hooks active, and stops on the first failure. Partial progress
is returned instead of silently continuing. Results always include native
`structuredContent` and one compact human-readable text summary.

Mutating apply and commit operations are serialized per checkout with an atomic
lock in the Git common directory. Same-process calls queue; other server
processes wait briefly for the lock. A lock is reclaimed only when its owner is
gone or its lease is demonstrably stale, and every completed operation releases
it in a `finally` path.

For `prepare_repository_change`, `write` carries complete replacement content.
`edit` carries an existing-file SHA-256 and exact `replacements` of
`oldText`/`newText`; an empty `newText` deletes the anchored text. Every anchor
must occur exactly once in the original snapshot, and overlapping anchors are
rejected. `delete` carries an existing tracked-file SHA-256 and no content.
The server computes the final file, preserves bytes outside the anchors, and
feeds it through the same content guards and diff review as a full write.
Missing, untracked, directory, symlink, ignored, sensitive, binary,
credential-like, and oversized targets remain denied. A single operation is
limited to 20 files and each profile keeps its existing aggregate byte budget.
The preparation result includes `reviewHash`, `instanceId`, and `expiresAt`.

The apply step rechecks the review hash, every current file hash, and tracked
status under the checkout mutation lock. Writes remain atomic. Each delete is first moved to a unique
same-directory tombstone, the original path is verified absent, and tombstones
are removed only after all operations and final hash checks succeed. Any
observed failure restores tombstones or captured content and removes created
files before returning `failed`.
This is operation-level rollback only; it does not recursively delete
directories or integrate with an operating-system trash.

`search_repository` performs bounded literal matching over visible tracked,
dirty, and untracked files. It returns stable path/line/column matches,
single-line previews, file hashes, scan counts, and continuation metadata.
It accepts up to 20 profile-allowed roots, 200 results, 5,000 candidate files,
and 32 MiB of accepted text per call; query strings are never executed.

Diff previews are capped at 16,000 characters. The server reports the full
character and UTF-8 byte totals, the next offset, and every path omitted from the
preview. Reader requests accept offsets and up to 64,000 characters per chunk;
each file must be at most 1,000,000 bytes and the aggregate response is capped
at 256,000 characters. Review diffs larger than the 8,000,000-character storage
ceiling are rejected with a request to split the change. `read_repository_files`
reads up to 20 profile-allowed text files in one bounded request, defaults to
16,000 characters per file, and returns hashes, byte totals, completion state,
and pagination offsets. Line ranges are 1-based and inclusive, capped at 500
lines, and return `nextLine` when the requested range needs another call. When
a requested path is outside the selected profile, the structured error names
every attempted path and explains the explicit permission flow; no content is
read before access is granted. The source reader and
text-change flow reject binary extensions, NUL-containing content, ignored
runtime directories, sensitive environment or credential names (except the safe-template `.env.example` and guarded root `.envrc` exceptions), and
credential-like/private-key content even when the broad `repository` profile
would otherwise match the path.

### Profile read permissions

`grant_repository_read_access` is the only path that can widen a focused read
profile. It is approval-gated (`approve: true`) and accepts only exact safe
paths. Ask the user before invoking it; do not treat a model-generated tool
call as implicit consent.

- `scope: "temporary"` returns a short-lived `permissionToken` (15 minutes)
  bound to the selected profile and exact paths. Pass that token to
  `read_repository_files`; it is consumed after one successful read and cannot
  be reused for another request.
- `scope: "permanent"` records the exact paths for that profile in a
  user-local allowlist outside the checkout. The default file is
  `$XDG_CONFIG_HOME/operator-synaciel-repository/read-allowlist.json`, or
  `~/.config/operator-synaciel-repository/read-allowlist.json` when
  `XDG_CONFIG_HOME` is unset. Set `OPERATOR_SYNACIEL_MCP_READ_ALLOWLIST` to an
  absolute path outside the checkout to choose another location.
- The allowlist is owner-readable only, bound to the current canonical checkout
  and profile, and capped at 200 paths per profile. It never overrides
  traversal, ignored-runtime, sensitive-name (except safe-template `.env.example` and guarded root `.envrc`), binary,
  or credential-like content checks. No file contents or permission secrets are
  stored in it.

The root `.env.example` is an explicit safe-template exception. The root
`.envrc` is a separate exact safe exception only when its content is the
guarded Nix entrypoint (`if command -v nix >/dev/null 2>&1; then`, followed by
`use flake` and `fi`). The `config` and broad `repository` profiles may
read or review those exact safe paths, while nested `.envrc` paths, unsafe
`.envrc` content, and real `.env` variants remain denied. Filename safety
does not bypass the credential-like-content check, so a template containing a
non-placeholder secret-like assignment is still rejected.

If the MCP client supports form elicitation, a denied `read_repository_files`
call can ask the user inline and continue with the selected scope. Clients
without elicitation support receive the named-path error and must provide the
explicitly user-approved `scope` on the approval-gated tool call.

`prepare_repository_change` uses a separate write-profile boundary. Its
directory-denial errors also name the attempted path, but read permissions never
widen write access. If a change genuinely belongs outside a focused write
profile, ask the user first and retry with the broader `repository` profile;
the normal hash review and approval-gated apply step still remain required.

Prepared plans and commit operations expire after 30 minutes and are evicted
under a 64 MiB retained-review budget. Verification results are cached for 30
seconds against the Git/status/dependency fingerprint; successful cache hits are
reported as `cached: true`.


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

All thirteen repository MCP tools advertise a native `outputSchema` in
`tools/list`. Successful calls return the canonical object in
`structuredContent` and retain one compact human-readable text summary for
text clients.

The output families are:

- `repository_workflow_status` returns readiness, tooling, Git hook, and
  capability status, server instance ID, and `checkedAt`/`cacheHit` metadata.
- `search_repository` returns bounded literal matches, hashes, scan counts, and
  continuation metadata.
- `read_repository_files` returns bounded, profile-checked source snapshots for
  up to 20 files with per-file hashes, byte totals, and pagination offsets.
- `grant_repository_read_access` returns an approval-gated temporary token or
  records exact paths in the user-local allowlist; it never returns file
  content.
- `prepare_repository_change` returns either a prepared plan with hashes and
  an apply token, review hash, instance ID, and expiry, or a structured
  rejection; edit and delete summaries carry their action metadata.
- `apply_repository_change` returns an applied result, verification-failure
  result, conflict, failed result, or structured
  rejection. Repeating a completed apply with the same plan/token/review hash
  returns the original result. `finalFileHashes` uses `null` for deleted paths.
- `verify_repository_change` returns a verification summary or rejection.
- `prepare_working_tree_commit` returns either a restricted-path consent
  challenge or a prepared snapshot with bounded diff metadata.
- `read_repository_change_diff` and `read_working_tree_diff` return bounded
  chunks from still-valid prepared operations and never accept arbitrary paths
  or source content.
- `git_commit_working_tree` and `git_commit_files` return committed or
  partial-commit results; `prepare_commits` returns bounded commit entries.
- Expected domain failures include `reasonCode`, `retryable`, and optional
  `nextAction`/`conflicts` entries with expected and current hashes.
  Schema-validation failures remain MCP protocol errors.

`outputSchema` is a tool contract. This local repository MCP exposes no
resources, so there is no resource output schema to advertise.

Git status and commit diagnostics in returned commit results are capped at
12,000 characters; the complete command remains visible so a caller can rerun
the corresponding fixed check when the diagnostic tail is omitted.

## Profiles

- `app` covers `apps/portfolio-web/` application files.
- `docs` covers the vault, root documentation, and design context.
- `mcp-fast` covers only the fixed MCP configuration and MCP typecheck commands
  for rapid iteration; its successful results are cached briefly.
- `repository` is the broadest source and planned-change profile. It covers
  every current tracked workspace boundary: `apps/`, the entire
  `workers/` tree (including `workers/portfolio-api/` and
  `workers/portfolio-mcp/`), `tools/`, `tests/`, `scripts/`,
  documentation, workflows, restricted developer directories, editor
  configuration, and root manifests. Ignored runtime directories, binary source
  files, sensitive names (except safe-template `.env.example` and guarded root `.envrc`), and credential-like content
  remain denied.
- `mcp` remains focused on local/public MCP implementation, tests, scripts,
  hooks, workflows, docs, and MCP metadata.
- `database` remains focused on API migrations, schema, seed, Drizzle, and
  Wrangler configuration; the broad `repository` profile intentionally
  includes the full API Worker for cross-boundary reviews.
- `config` covers ordinary root and workspace configuration while keeping
  database artifacts on the dedicated database profile.
- `full` runs the complete fixed local check set.

Verification uses only repository-native npm scripts. The broad `repository`
verification profile runs documentation and skills checks, local and public MCP
checks/tests, API typecheck/tests and web tests (api_typecheck, api_test, web_test),
migration validation/listing, root typecheck,
lint, Biome, and the production build. It does not deploy, contact remote Git,
read Cloudflare credentials, or apply local/remote D1 migrations. The MCP never
accepts arbitrary shell commands or deployment operations.

## Setup

```bash
npm install
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
# Optional warm compiled launcher output
npm run mcp:build
OPERATOR_SYNACIEL_MCP_COMPILED=1 npm run mcp:repository
npm run setup:git-hooks
pipenv install --dev --deploy
pipenv run graphify update . --no-cluster
```

Use `repository_workflow_status` after setup to inspect the active root,
registrations, dependency readiness, Graphify output, vault index, and hooks.
The status tool is read-only and does not return secrets. A missing Graphify
output is an onboarding warning, not a reason to mutate the repository through
the MCP.

Restart long-lived MCP clients after changing the server version, tool list, or
input/output schemas so they reload the current registration.

The local stdio server uses the tsx source launcher by default. After
`npm run mcp:build`, setting `OPERATOR_SYNACIEL_MCP_COMPILED=1` selects the
compiled `tools/repository-mcp/dist/server.js` entrypoint and fails closed if it
is missing; there is no silent source fallback. It requires Git, Node/npm, Bash,
and the existing repository toolchain. A collaborator must trust or approve project-scoped MCP
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

The synchronous Codex commit gate recognizes direct Git invocations and the
supported `bash`/`sh`, `env`, `command`, `eval`, and `exec` wrappers while
ignoring quoted search text and comments.

The repository does not install a generic filesystem writer or run an
automatic post-commit Graphify rebuild. Graphify state is ignored local output
and is updated explicitly with `pipenv run graphify update .`.

## Related notes

- [[architecture/repository-layout|Repository layout]] - workspace ownership and root discovery files.
- [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] - the separate public read-only service.
- [[operations/local-development|Local development]] - workspace commands and deployment boundaries.
- [[database/migrations|Database migrations]] - readable SQL review and apply workflow.
- [[obsidian|Obsidian vault and skills]] - native Obsidian skill installation.
