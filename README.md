# Operator-Syn

Operator-Syn is a React and TypeScript portfolio frontend built with Vite. Its
API is a Hono Cloudflare Worker backed by D1, R2, and a separate auth Worker.

## Start here

The repository documentation is also an Obsidian vault:

- [Documentation map](docs/README.md)
- [Architecture overview](docs/architecture/overview.md)
- [Local development](docs/operations/local-development.md)
- [Repository MCP and commit pipeline](docs/operations/repository-mcp.md)
- [Database migrations](docs/database/migrations.md)

## Development

```bash
npm install
npm run dev
```

Run the checks used before a change is considered ready:

```bash
npm run lint
npm run build
npm run docs:check
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
```

The frontend preview command is `npm run preview`. The production frontend is
deployed through Cloudflare Pages Git integration with `npm run build` and
`dist` as the output directory; root Pages Functions are deployed alongside
that output. The `npm run deploy` script remains a legacy `gh-pages` publisher
and does not deploy Pages Functions. Worker deployment is configured separately
through `wrangler.toml`.

## Graphify

The repository has a local Graphify code graph managed by Pipenv. It indexes
TypeScript, TSX, and SQL source; Markdown documentation is intentionally kept
out of that graph and is indexed through the Obsidian documentation map.

```bash
pipenv install --dev --deploy
pipenv run graphify query "How does the frontend connect to the Hono API?"
pipenv run graphify update . --no-cluster
```

Compatible clients discover the project-local MCP servers through
[`.mcp.json`](.mcp.json); Codex also reads the project-scoped
[`.codex/config.toml`](.codex/config.toml) for approval policy. The generated
graph remains local under `graphify-out/`.

## Database changes

Future D1 schema changes use the readable SQL workflow documented in
[`docs/database/migrations.md`](docs/database/migrations.md). Existing schema
and bootstrap seed files are reference inputs, not migration history.
