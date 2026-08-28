# Operator-Syn

Operator-Syn is an npm monorepo containing the React/Vite portfolio frontend,
its Hono/D1/R2 API Worker, a public Streamable HTTP portfolio MCP Worker, and a
local repository-only stdio MCP server.

## Start here

The repository documentation is also an Obsidian vault:

- [Documentation map](docs/README.md)
- [Architecture overview](docs/architecture/overview.md)
- [Local development](docs/operations/local-development.md)
- [Public portfolio MCP (Streamable HTTP)](docs/architecture/portfolio-mcp.md)
- [Local repository MCP (stdio) and commit pipeline](docs/operations/repository-mcp.md)
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
deployed through Cloudflare Pages Git integration with the Pages project root
set to `apps/portfolio-web`, `npm run build` as the build command, and `dist`
as the output directory; Pages Functions are discovered from that workspace.
The `npm run deploy` script remains a legacy `gh-pages` publisher and does not
deploy Pages Functions. Worker deployment is configured separately in each
Worker workspace.

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
