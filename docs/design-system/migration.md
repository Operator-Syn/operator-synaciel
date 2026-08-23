---
title: Design System Migration
aliases:
  - Bootstrap migration
  - Frontend styling migration
tags:
  - design-system
  - migration
role: plan
---

# Design System Migration

The migration is staged on `revamp/portfolio-dalan` and changes presentation,
not content ownership.

## Order

1. Install Tailwind v4 and establish the global token and type foundation.
2. Convert the shell, navigation, page frame, pagination, media renderer, and
   dialog primitives.
3. Migrate Home against [[design-system/homepage-fidelity|the homepage fidelity
   contract]], then Projects and Certificates, then Snippets.
4. Convert shared legal/static wrappers so removing Bootstrap does not break
   hidden routes.
5. Remove Bootstrap dependencies, dead styles, and old palette references.
6. Update this vault and run source, browser, and build verification.

## Compatibility invariants

- Keep `/api/settings`, `/api/profile`, `/api/sections`, and section-item calls.
- Keep the existing `/api/projects` and gallery response shapes and modal
 behavior; the Projects archive uses the additive cursor-backed
  `/api/v2/projects/archive` route.
- Keep certificate and certificate-item response shapes and pagination.
- Keep recursive snippets data, canonical paths, Markdown/PDF formats,
  preview, copy, download, loading, and error behavior.
- Do not add D1 columns, tables, routes, or migrations for visual labels.

Use `http://localhost:5173` or `http://127.0.0.1:5173` for local browser
verification; both origins are in the API CORS allowlist.

## Verification gates

Run `npm run docs:check`, `npm run typecheck`, `npm run lint`, and
`npm run build`. Inspect all four public routes at desktop and mobile widths,
including loading, error, empty, modal, pagination, preview, download,
keyboard, focus, and reduced-motion states.
