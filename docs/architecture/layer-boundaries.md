---
title: Controller and Model Boundaries
tags:
  - architecture
  - api
  - database
role: audit
---

# Controller and Model Boundaries

The current API is predominantly a **fat-model, skinny-controller** design.
This is an observation of the current source, not a recommendation to refactor
it immediately.

## Verdict

- Most controllers translate Hono requests into model calls and model results
  into HTTP responses.
- Models own raw D1 SQL, row mapping, ordering, aggregation, and several data
  invariants.
- `SnippetsPageController` and `MediaController` are substantial exceptions.
  They handle multipart or JSON parsing, validation, R2 operations, presigned
  URLs, and response-specific behavior.
- There is no separate service or use-case layer between controllers and
  models.

## Responsibility matrix

| Responsibility | Current owner | Notes |
| --- | --- | --- |
| Route registration and middleware | `src/Api.ts` | CORS, auth ordering, cache headers, and Hono route registration. |
| Request parsing and HTTP status | Controllers | JSON, multipart forms, path parameters, response bodies, and status codes. |
| Basic request validation | Mixed | Controllers validate transport input; models validate storage and domain constraints. |
| D1 SQL and row mapping | Models | Models use `D1Database.prepare()` and return typed or mapped results. |
| Cross-table aggregation | Aggregate models | `HomePageModel` and `ProjectsPageModel` build response-oriented structures. |
| Generic media storage | `MediaController` | Direct R2 list/get/put/delete and S3-compatible presigning. |
| Snippet storage and tree rules | `SnippetsPageModel` | D1 recursive queries, R2 content, parent validation, cycle checks, and cleanup. |
| Error-to-response mapping | Controllers and `serverErrors.ts` | The convention is mixed between shared handling and local error responses. |

## Change guidance

Keep new HTTP concerns in controllers and new persistence concerns in models.
When a workflow needs coordination across D1, R2, or multiple models, review
whether the existing model is becoming an infrastructure service before adding
more logic to a controller. See [[architecture/controllers|controller responsibilities]] and
[[architecture/models|model responsibilities]] for the detailed inventory.
