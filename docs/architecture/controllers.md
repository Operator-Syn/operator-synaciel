---
title: Controllers
tags:
  - architecture
  - api
role: catalog
---

# Controllers

Controllers under `src/controller/` are Hono request handlers. Their normal
contract is to read the Hono context, perform transport-level validation,
delegate data work to a model, and return an HTTP response.

The route registry and shared middleware remain in
[`src/Api.ts`](../../src/Api.ts). This note describes responsibilities, not a
second route list; see [[api/routes|API routes]] for route paths.

## Controller groups

| Group | Responsibility | Shape |
| --- | --- | --- |
| `HomePageController` and `ProjectsPageController` | Call aggregate models and wrap results or errors. | Thin adapters |
| Home CRUD controllers | Pass settings, profile, section, and section-item input to models. | Mostly thin; section items also normalize payload aliases and order fields. |
| Project and gallery controllers | Parse IDs, pass JSON payloads to models, and return created or updated rows. | Thin CRUD adapters |
| Certificate controllers | Parse IDs, pass CRUD payloads to models, and reload affected records. | Thin to moderate adapters |
| `CertificateItemsController` | Normalize certificate-item IDs and payload fields before model calls. | Moderate adapter |
| `MediaController` | List, upload, replace, presign, fetch, and delete R2-backed media. | Thick storage boundary |
| `SnippetsPageController` | Handle JSON folders, multipart uploads, IDs, parent/order validation, content types, streams, and HTTP errors. | Thickest request boundary |

## Boundary behavior

Controllers perform transport-facing work such as:

- reading `c.req` parameters, JSON bodies, and multipart forms;
- choosing status codes for invalid IDs, missing resources, and unsupported
  content types;
- shaping success and error response envelopes;
- delegating persistence to a model in most data routes.

The media controller is intentionally different from ordinary CRUD controllers:
it owns direct R2 operations and an S3-compatible presign client. The snippets
controller is also more than a pass-through because one endpoint accepts two
content types and it validates parent and display-order inputs before invoking
the model.

## Error handling

The codebase uses both shared `respondWithInternalError()` handling and local
`console.error()` plus generic error responses. When changing a controller,
preserve the endpoint's existing response shape and status behavior unless the
API contract is intentionally being changed.

Controllers should not duplicate SQL or rebuild model-owned aggregates. If a
controller needs more persistence coordination, review [[architecture/layer-boundaries|the
layer assessment]] before adding another responsibility.
