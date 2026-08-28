---
title: Repository Layout
tags:
  - architecture
  - structure
role: catalog
---

# Repository Layout

Operator-Syn is an npm monorepo organized around deployable runtimes and
repository tooling. The root is an orchestrator and discovery surface; runtime
implementation belongs to the workspace that owns it.

Runtime relationships are summarized in [[architecture/overview|Architecture Overview]], while commands and deployment boundaries live in [[operations/local-development|Local Development]]. The two MCP workspaces have separate contracts: [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] and [[operations/repository-mcp|Local Repository MCP (stdio)]].

## Workspace map

- `apps/portfolio-web/` - React/Vite portfolio frontend, Cloudflare Pages
  Functions, static assets, social-preview generator, and Pages configuration.
- `workers/portfolio-api/` - Hono API Worker, D1/R2 models and controllers,
  database schema, reviewed migrations, and API Worker configuration.
- `workers/portfolio-mcp/` - separate stateless public MCP Worker using
  Streamable HTTP and its read-only portfolio API adapter.
  See [[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]]
  for its internal seams.
- `tools/repository-mcp/` - approval-gated repository-only MCP implementation
  using local stdio.
- `tests/portfolio-web/` - frontend, route, visual-contract, preference, and
  social-preview tests.
- `tests/portfolio-api/` - API Worker model, controller, pagination, and
  server-error tests.
- `tests/portfolio-mcp/` - public Streamable HTTP MCP protocol and boundary
  tests.
- `tests/repository-mcp/` - local stdio repository MCP protocol and
  commit-pipeline tests.
- `tests/scripts/` - repository hook, launcher, and skill-validation tests.

## Portfolio web workspace

- [`apps/portfolio-web/src/main.tsx`](../../apps/portfolio-web/src/main.tsx) -
  React entrypoint and providers.
- [`apps/portfolio-web/src/App.tsx`](../../apps/portfolio-web/src/App.tsx) -
  navigation shell and route rendering.
- `apps/portfolio-web/src/components/` - reusable UI, route pages, and visual
  behavior.
- `apps/portfolio-web/src/data/` - route metadata, public context, cache
  settings, and frontend data types.
- `apps/portfolio-web/src/preferences/` - browser-local theme and motion
  preferences.
- `apps/portfolio-web/src/styles/` - application tokens, layout, and styles.
- `apps/portfolio-web/functions/` - Pages Functions for crawler metadata and
  generated social-image handling.
- `apps/portfolio-web/public/` - static assets, discovery files including
  `.well-known/` verification metadata, and generated social-preview images.

## Portfolio API workspace

- [`workers/portfolio-api/src/entrypoint.ts`](../../workers/portfolio-api/src/entrypoint.ts)
  - Hono Worker entrypoint, CORS, auth boundary, and route registration.
- `workers/portfolio-api/src/bindings.ts` - API Worker binding interface used
  by controllers without coupling them to route registration.
- `workers/portfolio-api/src/controller/` - request handlers and media
  adapters.
- `workers/portfolio-api/src/model/` - D1/R2 persistence and response-shaping
  models.
- `workers/portfolio-api/src/db/schema.ts` - canonical Drizzle schema.
- `workers/portfolio-api/src/data/Initial-Seed.sql` - bootstrap portfolio
  content, not migration history.
- `workers/portfolio-api/migrations/` - reviewed D1 migration SQL and metadata.
- `workers/portfolio-api/wrangler.toml` - API Worker, D1, R2, auth binding,
  route, and observability configuration.

## Root orchestration and discovery

The following files intentionally remain at the repository root:

- `package.json` and `package-lock.json` - npm workspace orchestration and
  shared repository commands.
- `Pipfile` and `Pipfile.lock` - Pipenv-managed Graphify tooling.
- `tsconfig.json` and `tsconfig.tests.json` - root TypeScript references and
  cross-workspace test checking.
- `README.md`, `AGENTS.md`, `PRODUCT.md`, and `DESIGN.md` - repository entry
  points and agent/design context.
- `.mcp.json` and `.codex/config.toml` - project-scoped MCP discovery and
  Codex approval policy.
- `scripts/` - repository-wide documentation, hook, launcher, and validation
  operations. The root-safe `scripts/mcp-launcher.mjs` remains the stable
  bridge to local stdio servers.
- `docs/` - canonical documentation and Obsidian vault.
- `.githooks/`, `.agents/`, `.codex/`, and `.impeccable/` - repository workflow
  and agent tooling discovered from the root.

Generated or local state such as `dist/`, workspace build output, `.wrangler/`,
`.venv/`, and `graphify-out/` is not source documentation.
