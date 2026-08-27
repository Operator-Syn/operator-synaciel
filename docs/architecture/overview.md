---
title: Architecture Overview
tags:
  - architecture
role: concept
---

# Architecture Overview

Operator-Syn is a split frontend and API project. The source of truth for the
frontend entrypoint is [`src/main.tsx`](../../src/main.tsx); the Worker entrypoint
is [`src/Api.ts`](../../src/Api.ts).

## Frontend

- Vite builds the React and TypeScript application.
- `src/main.tsx` creates the React root, installs React Query, and mounts a
  `BrowserRouter`.
- `src/App.tsx` renders the navigation shell and maps the route registry to
  React Router routes.
- `src/data/NavLinks.types.ts` defines the brand name, visible navigation, and
  all application routes.

The route list includes the home, projects, certificates, snippets, privacy,
terms, NetBird, and Atelier pages. The snippets page also supports nested
paths.

## API and storage

The Hono Worker in [`src/Api.ts`](../../src/Api.ts) exposes `/api/*` routes and
uses these bindings from [`wrangler.toml`](../../wrangler.toml):

- `DB` for Cloudflare D1 data.
- `BUCKET` for Cloudflare R2 media and snippet files.
- `AUTH_WORKER` for auth validation on private routes.
- `VITE_CDN_URL`, `R2_BUCKET_NAME`, and related environment values for storage
  integration.

Controllers under `src/controller/` coordinate requests. Models under
`src/model/` issue D1 queries and shape data for the controllers. The current
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
