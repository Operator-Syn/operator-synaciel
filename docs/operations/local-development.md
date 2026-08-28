---
title: Local Development
tags:
  - operations
  - development
role: guide
---

# Local Development

Operator-Syn uses npm workspaces. Run commands from the repository root for
the stable orchestration aliases, or from a workspace when working directly
on one runtime.

## Install and application development

Install all workspace dependencies and start the portfolio frontend:

```bash
npm install
npm run dev
```

The frontend workspace is `apps/portfolio-web/`. Its Vite entrypoint is
`apps/portfolio-web/src/main.tsx`, its Pages Functions live in
`apps/portfolio-web/functions/`, and its local build output is
`apps/portfolio-web/dist/`.

Useful root checks are:

```bash
npm run typecheck
npm run lint
npm run check:biome
npm run build
npm run preview
```

Cloudflare Pages should use `apps/portfolio-web` as its project root, `npm run
build` as its build command, and `dist` as its output directory; Pages
Functions are discovered from the `functions/` directory at that workspace
root. Cloudflare Pages' monorepo support and Functions routing require that
project-root arrangement; this repository does not deploy Pages from the
legacy root layout.

## Portfolio API Worker

The Hono API Worker is the `workers/portfolio-api/` workspace. Its entrypoint
is `workers/portfolio-api/src/entrypoint.ts`; D1/R2 models and controllers
remain inside that workspace. Run its local Worker directly with:

```bash
npm run dev --workspace=@syn-forge/portfolio-api
```

The root API aliases delegate to this workspace:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
npm run db:migrations:list:local
```

The checked-in Wrangler configuration is
`workers/portfolio-api/wrangler.toml`. Database migration application remains
an explicit operation; do not treat typechecks or Worker builds as migration
application.

## Public portfolio MCP — remote Streamable HTTP

The public, read-only portfolio MCP is isolated in `workers/portfolio-mcp/`.
It is a remote stateless Cloudflare Worker using Streamable HTTP at
`https://mcp.syn-forge.com/mcp`; it is not the local stdio repository MCP.
Check and test it with:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
npm run mcp:portfolio:dev
```

The production deployment wrapper is `npm run mcp:portfolio:deploy`; it
delegates to the workspace's `wrangler.toml`. Deployment and custom-domain
activation are separate from local checks. See
[[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] for its Service Binding and
post-deploy verification contract. See
[[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]] when changing its
internal Worker modules.

## Local repository MCP — stdio

The local repository-only MCP is the `tools/repository-mcp/` workspace. It is a
stdio subprocess with no public URL. Its root-safe client bridge remains
`scripts/mcp-launcher.mjs` so `.mcp.json` and Codex can resolve a relocated Git
checkout.

Use [[operations/repository-mcp|Local Repository MCP (stdio) and Commit Pipeline]]
for the guarded change and commit workflow. The local checks for repository
tooling are:

```bash
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
```

This MCP is local-only. It does not expose the public portfolio contract, deploy,
access Cloudflare credentials, or apply D1 migrations. Graphify updates remain
an explicit separate step.

## Graphify

Graphify is managed by Pipenv and keeps generated state under
`graphify-out/`:

```bash
pipenv install --dev --deploy
pipenv run graphify query "How does the frontend connect to the Hono API?"
pipenv run graphify update . --no-cluster
```

The repository Graphify configuration is code-only. Use the vault map for
Markdown documentation rather than expecting the code graph to contain notes.

## D1 workflow

Use [[database/drizzle|Drizzle tooling]] and [[database/migrations|the migration guide]] for schema changes. The editable schema and migrations are owned by
`workers/portfolio-api/`:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
npm run db:migrations:apply:local
```

Inspect SQL and verify the local schema before considering a remote apply.
Existing seed content is not migration history.

Do not put secrets in committed environment files. The frontend preserves the
root `.env` location for local Vite variables through its configured `envDir`;
workspace-specific deployment settings remain in their Wrangler files.
