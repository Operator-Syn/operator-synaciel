# Repository guidance

## Documentation and routing

- `docs/` is the canonical project documentation and Obsidian vault. Start at
  [`docs/README.md`](docs/README.md).
- Update the existing focused canonical note before creating another one. If a
  rule needs durable detail, add it to the relevant vault note and link it
  here; keep this file to routing and non-obvious repository rules.
- Use the [workspace map](docs/architecture/repository-layout.md) to find the
  owner of a change and [local development](docs/operations/local-development.md)
  for contributor commands. Tests live beside their owning workspace under
  `<workspace>/tests/`; shared repository-script tests live in `scripts/tests/`.
- When changing `workers/portfolio-mcp/`, read the [public MCP module structure](docs/architecture/portfolio-mcp-modules.md)
  for its seams and split criteria.
- Keep `README.md` as the short GitHub front door. Put durable architecture,
  database, and operational detail in the vault.

## Agent tooling

- Repository skills live in `.agents/skills/`, including the shared
  `repository-quality` workflow. `.codex/` holds Codex-specific hooks; hooks
  are in-turn checks, not a substitute for verification.
- Keep review explicit: inspect the narrowest source, configuration, tests, and
  consumers; run the affected checks; review the complete diff before
  committing.
- Impeccable discovers [product context](docs/PRODUCT.md) and
  [design context](docs/DESIGN.md) in `docs/`. Shared hook policy stays in
  `.impeccable/config.json`; do not create duplicate context files.

## Local commits

- Run `npm run setup:git-hooks` before committing and keep the versioned
  `core.hooksPath=.githooks` active. Never bypass a hook with `--no-verify` or
  by changing `core.hooksPath`.
- Pushing, deployment, remote Git operations, Cloudflare credentials, and D1
  migration application remain separately authorized actions.

## Obsidian

- Follow [`docs/obsidian.md`](docs/obsidian.md) for native plugin installation,
  vault registration, and CLI verification. Keep Obsidian skills native and
  outside this repository; do not mirror them here.

## Verification

- `npm run docs:check` validates vault links and documentation layout.
- Repository-tooling checks are `npm run skills:check` and
  `npm run test:tooling`. Use the workspace-specific checks documented in the
  operations notes.
- The documentation hook is read-only and advisory. It must not rewrite notes,
  access Cloudflare, or apply database migrations.
