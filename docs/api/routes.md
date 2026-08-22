---
title: API Routes
tags:
  - api
  - architecture
role: catalog
---

# API Routes

The route source is [`src/Api.ts`](../../src/Api.ts). CORS is applied to all
routes, `OPTIONS /api/*` handles preflight requests, and API responses default
to `no-store` unless a route overrides the cache headers.

The implementation boundary is documented in
[[architecture/controllers|the controller map]] and
[[architecture/layer-boundaries|the layer assessment]].

## Public routes

These GET routes are registered before the private auth middleware:

| Area | Routes |
| --- | --- |
| Projects | `GET /api/projects`, `GET /api/project/:id`, `GET /api/project/:projectId/gallery` |
| Snippets | `GET /api/snippets`, `GET /api/snippets/:id`, `GET /api/snippets/:id/content` |
| Home content | `GET /api/settings`, `GET /api/profile`, `GET /api/sections`, `GET /api/sections/:sectionId/items` |
| Project media | `GET /api/projects/media`, `GET /api/projects/media/:key{.+}` |
| Certificate media | `GET /api/certificates/media`, `GET /api/certificates/media/:key{.+}` |
| Certificates | `GET /api/certificates`, `GET /api/certificates/:id`, `GET /api/certificates/:certId/items` |

## Private routes

All routes below require an `auth_token` cookie. The Worker forwards the cookie
to `AUTH_WORKER` at `https://auth-worker/auth/user`. Missing cookies return
`401`; a failed auth response returns `403`.

| Area | Routes |
| --- | --- |
| Project media | `POST /api/projects/media`, `PUT /api/projects/media/:key{.+}`, `DELETE /api/projects/media/:key{.+}`, `POST /api/projects/media/presign` |
| Certificate media | `POST /api/certificates/media`, `PUT /api/certificates/media/:key{.+}`, `DELETE /api/certificates/media/:key{.+}`, `POST /api/certificates/media/presign` |
| Projects | `POST /api/project`, `PUT /api/project/:id`, `DELETE /api/project/:id` |
| Gallery | `POST /api/gallery`, `PUT /api/gallery/:id`, `DELETE /api/gallery/:id` |
| Certificates | `POST /api/certificates`, `PUT /api/certificates/:id`, `DELETE /api/certificates/:id` |
| Certificate items | `POST /api/certificates/items`, `PUT /api/certificates/items/:id`, `DELETE /api/certificates/items/:id` |
| Snippets | `POST /api/snippets`, `PATCH /api/snippets/:id`, `DELETE /api/snippets/:id` |
| Home content | `POST`, `PUT`, `DELETE` routes for settings, profile, sections, and section items |

Keep this note aligned with `src/Api.ts`; route behavior belongs in the source
and tests, not in a duplicated implementation.
