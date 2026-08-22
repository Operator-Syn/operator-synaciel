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
- `src/components/pages/` - route-level page components.
- `src/controller/` - Worker request handlers and media controllers.
- `src/model/` - D1 and R2-facing data access models.
- `src/data/` - route configuration, types, cache settings, schema reference,
  and bootstrap seed reference.
- `src/types/` - shared frontend types.
- `src/utils/` - small shared helpers and server error handling.

`src/assets/` currently contains no application asset files. Static files served
as-is live under `public/`, including `public/assets/`.

## Project operations

- `docs/` - canonical documentation and Obsidian vault.
- `migrations/` - future top-level D1 SQL migrations only.
- `wrangler.toml` - Worker, D1, R2, service, route, and observability config.
- `package.json` and `package-lock.json` - Node scripts and dependencies.
- `Pipfile` and `Pipfile.lock` - Pipenv-managed Graphify tooling.
- `mcp/` - the approval-gated repository MCP and fixed verification profiles.
- `tests/mcp/` and `tests/scripts/` - MCP protocol and commit-hook regression tests.
- `.githooks/` - versioned pre-commit and pre-push commit boundaries.
- `.codex/` - repository-local MCP registrations, Graphify, and Codex hooks.
- `.agents/skills/github-commit-pipeline/` - focused repository-local commit workflow skill.
- Obsidian skills are installed natively by Codex and cached outside this
  repository; they are documented in [[obsidian|Obsidian vault and skills]].

Generated or local state such as `dist/`, `.wrangler/`, `.venv/`, and
`graphify-out/` is not source documentation.
