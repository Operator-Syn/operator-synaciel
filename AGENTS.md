# Repository guidance

## Documentation and routing

- `docs/` is the canonical project documentation and Obsidian vault. Start at
  [`docs/README.md`](docs/README.md).
- Update the existing focused canonical note before creating another one. If a
  rule needs durable detail, add it to the relevant vault note and link it
  here; keep this file to routing and non-obvious repository rules.
- Runtime code belongs to `apps/portfolio-web/`, `workers/portfolio-api/`,
  `workers/portfolio-mcp/`, or `tools/repository-mcp/`; tests are grouped under
  `tests/`. Load the [repository layout](docs/architecture/repository-layout.md)
  for ownership and root-file details, or [local development](docs/operations/local-development.md)
  for commands and runtime boundaries.
- When changing `workers/portfolio-mcp/`, read the [public MCP module structure](docs/architecture/portfolio-mcp-modules.md)
  for its seams and split criteria.
- Keep `README.md` as the short GitHub front door. Put durable architecture,
  database, and operational detail in the vault.

## Graphify

- Graphify is managed by Pipenv: `pipenv run graphify ...`.
- For codebase questions, query `graphify-out/graph.json` first when it exists.
  Then confirm the cited source directly.
- After modifying code, run `pipenv run graphify update .`.
- Graphify indexes code only; Markdown documentation is navigated through the
  Obsidian map.

## Agent tooling

- `.mcp.json` is the clone-shared MCP registration; `.codex/config.toml` adds
  Codex-specific approval policy. Both use the root-safe launcher and fail
  outside a Git checkout.
- Use `repository_workflow_status` before mutation when the local MCP is
  available. The portable quality skill lives under
  `.agents/skills/repository-quality/`; the Codex adapter is under
  `.codex/skills/repository-quality/`.
- Use Graphify for code relationships and the local repository MCP for bounded
  changes, fixed verification, and local commits. Keep those capabilities
  separate and load visual tooling only for UI work.
- Impeccable shared context belongs in `PRODUCT.md`, `DESIGN.md`, and
  `.impeccable/config.json`; do not add a second context file.

## Local repository MCP and commits

- The local `operator-synaciel-repository` MCP is implemented in
  `tools/repository-mcp/`. Read the [local repository MCP guide](docs/operations/repository-mcp.md)
  for its guarded change, verification, and commit workflow. The public
  portfolio MCP is a separate remote Streamable HTTP Worker documented in the
  [portfolio MCP note](docs/architecture/portfolio-mcp.md).
- Use `repository_workflow_status` before MCP mutation. Run
  `npm run setup:git-hooks` before committing; direct shell `git commit` and
  hook bypasses are unsupported.
- The repository MCP never deploys, accesses Cloudflare credentials, applies
  D1 migrations, or performs remote Git operations. Pushes, deployment, and
  database application remain separately authorized actions.

## Obsidian

- Follow [`docs/obsidian.md`](docs/obsidian.md) for native plugin installation,
  vault registration, and CLI verification. Keep Obsidian skills native and
  outside this repository; do not mirror them here.

## Verification

- `npm run docs:check` validates vault links and documentation layout;
  `npm run mcp:check` validates clone-safe MCP registration.
- Repository-tooling checks are `npm run skills:check`,
  `npm run mcp:typecheck`, and `npm run test:mcp`. Use the workspace-specific
  checks and full verification profiles documented in the operations notes.
- The documentation hook is read-only and advisory. It must not rewrite notes,
  update Graphify, access Cloudflare, or apply database migrations.
