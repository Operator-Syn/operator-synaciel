# Repository guidance

## Documentation

- `docs/` is the project documentation and Obsidian vault. Start at
  [`docs/README.md`](docs/README.md).
- Update the existing canonical note before creating another note. Keep notes
  focused, source-grounded, and linked with meaningful Obsidian wikilinks.
- The root `README.md` is the short GitHub front door. Do not duplicate the
  vault's architecture or database explanations here.

## Graphify

- Graphify is managed by Pipenv. Run it as `pipenv run graphify ...`.
- For codebase questions, query `graphify-out/graph.json` first when it exists.
  Use `query`, `path`, or `explain` for focused context.
- After modifying code, run `pipenv run graphify update .`.
- Graphify is code-only in this repository. Documentation is indexed through
  the Obsidian map, not the generated graph.

## Repository MCP and commits

- Use the local `operator-synaciel-repository` MCP for guarded file changes and
  one-file local commits. Review paths, hashes, diffs, and verification results.
- Run `npm run setup:git-hooks` before committing. Direct shell `git commit` is
  blocked by the Codex hook; do not bypass the versioned Git hooks.
- The MCP never deploys, accesses Cloudflare credentials, or applies D1
  migrations. Pushes and remote GitHub actions require separate authorization.
- Use `.agents/skills/github-commit-pipeline/` for the generic prepare, verify,
  hook, stale-change, and commit workflow. Graphify remains the discovery MCP.

## Obsidian skills

- Install `codex-obsidian` natively from its GitHub marketplace source; do not
  copy or mirror the skills into this repository.
- The current verified source is `greg-asher/codex-obsidian` at ref
  `ed35c3782639f792d0338f0b0da7d8a5484b7b56`.
- Use the install and verification commands in `docs/obsidian.md` when the
  native plugin is missing or needs refreshing.

## Verification

- `npm run docs:check` validates the vault links and documentation layout.
- `npm run mcp:typecheck` and `npm run test:mcp` validate the repository MCP.
- The documentation hook is read-only and advisory. It must not rewrite notes,
  update Graphify, access Cloudflare, or apply database migrations.
