---
title: Architecture Overview
tags:
  - architecture
role: concept
---

# Architecture Overview

Operator-Syn is an npm monorepo with separate frontend, API Worker, public
Streamable HTTP MCP, and local repository-only stdio workspaces. The source of
truth for the frontend entrypoint
is [`apps/portfolio-web/src/main.tsx`](../../apps/portfolio-web/src/main.tsx);
the API Worker entrypoint is
[`workers/portfolio-api/src/entrypoint.ts`](../../workers/portfolio-api/src/entrypoint.ts).

## Frontend

- Vite builds the React and TypeScript application.
- `apps/portfolio-web/src/main.tsx` creates the React root, installs React Query, and mounts a
  `BrowserRouter`.
- `apps/portfolio-web/src/App.tsx` renders the navigation shell and maps the route registry to
  React Router routes.
- `apps/portfolio-web/src/data/NavLinks.types.ts` defines the brand name, visible navigation, and
  all application routes.

The route list includes the home, projects, certificates, snippets, AI and MCP,
privacy, terms, NetBird, and Atelier pages. The snippets page also supports
nested paths. The [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]]
note documents the separate agent-facing Worker and its deployment boundary;
[[operations/repository-mcp|Local Repository MCP (stdio)]] documents the
development-only repository tooling.

## API and storage

The Hono Worker in
[`workers/portfolio-api/src/entrypoint.ts`](../../workers/portfolio-api/src/entrypoint.ts)
exposes `/api/*` routes and uses these bindings from
[`workers/portfolio-api/wrangler.toml`](../../workers/portfolio-api/wrangler.toml):

- `DB` for Cloudflare D1 data.
- `BUCKET` for Cloudflare R2 media and snippet files.
- `AUTH_WORKER` for auth validation on private routes.
- `VITE_CDN_URL`, `R2_BUCKET_NAME`, and related environment values for storage
  integration.

Controllers under `workers/portfolio-api/src/controller/` coordinate requests.
Models under `workers/portfolio-api/src/model/` issue D1 queries and shape data for the controllers. The current
layer assessment is [[architecture/layer-boundaries|fat-model, skinny-controller with
storage-heavy exceptions]]. See [[architecture/controllers|controller responsibilities]] and
[[architecture/models|model responsibilities]] for the focused inventories. Media flows use
R2 directly through the media controller, while snippet storage is coordinated
by its model.

## Request boundary

Public GET routes are registered before the private middleware. The private
middleware requires an `auth_token` cookie and asks `AUTH_WORKER` to validate
the request before allowing writes. See [[api/routes|API routes]] for the
complete route grouping.

The root Worker route redirects to `https://www.syn-forge.com`. The frontend
deployment and Worker deployment are separate operations.
