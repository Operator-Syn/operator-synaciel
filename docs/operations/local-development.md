---
title: Local Development
tags:
  - operations
  - development
role: guide
---

# Local Development

## Node application

Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

Useful repository checks are:

```bash
npm run typecheck
npm run lint
npm run check:biome
npm run build
npm run preview
```

The root TypeScript solution includes the application, Vite, MCP, scripts, and
test projects. `npm run typecheck` reports the complete current TypeScript
diagnostic set without requiring files to be open. `npm run typecheck:watch`
keeps that set current as files change.

The workspace starts the TypeScript watch and Biome repository tasks when the
folder opens. Their problem matchers publish diagnostics to VS Code's Problems
panel before a source file is opened. Run the one-shot repository-wide Biome
check when you need the current formatting and lint result:

```bash
npm run check:biome
```

The checked-in `biome.json` enables Tailwind v4 directives, including `@theme`,
and keeps the CLI and editor on the same parser configuration. VS Code/Cursor
can install the recommended `biomejs.biome` extension from
`.vscode/extensions.json`.

Cloudflare Pages Git integration builds the frontend with `npm run build` and
publishes `dist`, including root Pages Functions. To exercise the Pages
Function locally after a build, run `npm run pages:dev`; this uses Wrangler's
Pages server rather than the separate API Worker configured in
[`wrangler.toml`](../../wrangler.toml).

`npm run deploy` remains a legacy `gh-pages` publisher and does not deploy
Pages Functions. The API Worker has no npm deployment wrapper.

The public portfolio MCP is a separate Worker package with a Service Binding
to `portfolio-api`. Check and test it with:

```bash
npm run mcp:portfolio:check
npm run test:portfolio-mcp
```

Use `npm run mcp:portfolio:dev` for its local Worker server. Its deployment
wrapper is `npm run mcp:portfolio:deploy`; do not treat a local check or dry run
as custom-domain activation. See
[[architecture/portfolio-mcp|the Portfolio MCP note]] for the client
configuration, deployment prerequisites, and post-deploy verification.

## Graphify

Graphify is managed by Pipenv and keeps generated state under
`graphify-out/`:

```bash
pipenv install --dev --deploy
pipenv run graphify query "How does the frontend connect to the Hono API?"
pipenv run graphify update . --no-cluster
```

The repository Graphify configuration is code-only. Use this vault's map for
Markdown documentation rather than expecting the code graph to contain notes.

## Repository MCP and hooks

Use [[operations/repository-mcp|the repository MCP guide]] for the approval-gated change
and commit workflow. The local checks for its tooling are:

```bash
npm run mcp:check
npm run skills:check
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
```

The MCP is local-only. It does not deploy, access Cloudflare credentials, or
apply database migrations. Graphify updates remain an explicit separate step.

## D1 workflow

Use [[database/drizzle|Drizzle tooling]] and [[database/migrations|the migration
guide]] for schema changes:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
npm run db:migrations:apply:local
```

Inspect SQL and verify the local schema before considering a remote apply.
Existing seed content is not migration history.

Do not put secrets in committed environment files. The Worker bindings and
non-secret variables are declared in [`wrangler.toml`](../../wrangler.toml).
