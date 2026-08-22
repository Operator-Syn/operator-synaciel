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
npm run lint
npm run build
npm run preview
```

`npm run deploy` builds the frontend through `predeploy` and publishes `dist`
with `gh-pages`. The Worker is configured in
[`wrangler.toml`](../../wrangler.toml); no npm Worker deployment wrapper is
currently defined.

## Graphify

Graphify is managed by Pipenv and keeps generated state under
`graphify-out/`:

```bash
pipenv install --deploy
pipenv run graphify query "How does the frontend connect to the Hono API?"
pipenv run graphify update . --no-cluster
```

The repository Graphify configuration is code-only. Use this vault's map for
Markdown documentation rather than expecting the code graph to contain notes.

## Repository MCP and hooks

Use [[operations/repository-mcp|the repository MCP guide]] for the approval-gated change
and commit workflow. The local checks for its tooling are:

```bash
npm run mcp:typecheck
npm run test:mcp
npm run setup:git-hooks
```

The MCP is local-only. It does not deploy, access Cloudflare credentials, or
apply database migrations. Graphify updates remain an explicit separate step.

## D1 workflow

Use [[database/migrations|the migration guide]] for schema changes. Inspect
SQL and apply locally before considering a remote apply. Existing seed content
is not migration history.

Do not put secrets in committed environment files. The Worker bindings and
non-secret variables are declared in [`wrangler.toml`](../../wrangler.toml).
