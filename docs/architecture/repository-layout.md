---
title: Repository Layout
tags:
  - architecture
  - structure
role: catalog
---

# Repository Layout

This note describes the current layout, not a generic starter template.

## Application source

- `src/main.tsx` - React entrypoint and providers.
- `src/App.tsx` - navigation shell and route rendering.
- `src/Api.ts` - Hono Worker entrypoint, CORS, auth boundary, and API routes.
- `src/components/` - reusable UI components, page components, styles, and
  loading placeholders.
- `functions/` - Cloudflare Pages Functions for generated social images and
  crawler-facing metadata rewriting.
- `workers/portfolio-mcp/` - separate stateless public MCP Worker, Wrangler
  configuration, and read-only portfolio API adapter.
- `src/components/pages/` - route-level page components.
- `src/controller/` - Worker request handlers and media controllers.
- `src/model/` - D1 and R2-facing data access models.
- `src/data/` - route configuration, types, cache settings, and bootstrap seed
  reference.
- `src/db/schema.ts` - canonical Drizzle schema used to generate D1 migrations.
- `src/types/` - shared frontend types.
- `src/utils/` - small shared helpers and server error handling.

`src/assets/` currently contains no application asset files. Static files served
as-is live under `public/`, including `public/assets/`.

## Project operations

- `docs/` - canonical documentation and Obsidian vault.
- `migrations/` - Drizzle-generated, reviewed D1 SQL migrations and metadata.
- `wrangler.toml` - Worker, D1, R2, service, route, and observability config.
- `package.json` and `package-lock.json` - Node scripts and dependencies.
- `Pipfile` and `Pipfile.lock` - Pipenv-managed Graphify tooling.
- `mcp/` - the approval-gated repository MCP and fixed verification profiles.
- `scripts/mcp-launcher.mjs` and `.mcp.json` - clone-safe stdio launch and
  cross-client MCP registration.
- `tests/mcp/` and `tests/scripts/` - MCP protocol and commit-hook regression tests.
- `.githooks/` - versioned pre-commit and pre-push commit boundaries.
- `.codex/` - repository-local MCP registrations, Graphify, and Codex hooks.
- `.agents/skills/github-commit-pipeline/` - focused repository-local commit workflow skill.
- `.agents/skills/repository-quality/` - portable source-grounded workflow and
  anti-slop references.
- `.agents/skills/impeccable/` and `.impeccable/` - project-local UI quality
  skill, detector hook policy, and generated design context.
- Obsidian skills are installed natively by Codex and cached outside this
  repository; they are documented in [[obsidian|Obsidian vault and skills]].

Generated or local state such as `dist/`, `.wrangler/`, `.venv/`, and
`graphify-out/` is not source documentation.
