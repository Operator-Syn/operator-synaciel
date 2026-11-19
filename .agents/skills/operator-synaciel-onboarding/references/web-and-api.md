# Portfolio web and API traces

The repository map names the owning workspace. This note narrows the two
content-serving workspaces: web is the React app plus the Pages Functions that
front it, API is the Hono Worker that owns D1 and R2. Use it to get from a
concrete issue to the smallest honest check.

Table spans are literal checkout paths; a directory ends with `/`. Shell
commands live in the prose because every backticked span in a table row is
indexed as a path. Paths only prove location: read the source, and treat a
passing test as evidence for what that test asserts, not for the whole route.

## Portfolio web

| Task | Start here | Trace and verify |
| --- | --- | --- |
| Change what a page fetches or displays | `apps/portfolio-web/src/components/pages/projectsPage/Projects.tsx` | Follow the fetch builder to the local response interface, then the row-to-view mapping and the child list component. The API response shape is restated here, not imported. |
| Change a page's layout, theme, or motion | `docs/DESIGN.md`, `docs/design-system/README.md`, `apps/portfolio-web/src/styles/app.css` | From `apps/portfolio-web/src/App.tsx` reach the route component, then read the route stylesheet, preference hooks, and theme tests. |
| Add, retire, re-case, or redirect a URL | `apps/portfolio-web/src/data/canonicalRoutes.ts`, `apps/portfolio-web/functions/routePolicy.ts`, `apps/portfolio-web/functions/canonicalRedirect.ts` | Serving and indexing are separate lists: removing a route from the served list 404s a live page, while the non-indexable set only withholds it from search. Verify with `apps/portfolio-web/tests/route-policy.test.ts` and `apps/portfolio-web/tests/canonical-routes.test.ts`. |
| Change the sitemap, structured data, or share preview | `apps/portfolio-web/src/data/sitemap.ts`, `apps/portfolio-web/src/data/structuredData.ts`, `apps/portfolio-web/src/data/socialPreview.ts`, `apps/portfolio-web/functions/_middleware.ts` | The middleware rewrites the served HTML head, so preview metadata and JSON-LD are checked on the response, not in `apps/portfolio-web/index.html`. Verify with `apps/portfolio-web/tests/sitemap.test.ts`, `apps/portfolio-web/tests/structured-data.test.ts`, `apps/portfolio-web/tests/social-preview.test.ts`, and `apps/portfolio-web/tests/route-indexability.test.ts`. |
| Change what the edge does when the API fails | `apps/portfolio-web/functions/contentFetch.ts`, `apps/portfolio-web/functions/snippetFolders.ts`, `apps/portfolio-web/functions/_middleware.ts` | Only an explicit 404 counts as missing; timeout, network, and 5xx stay unknown so working deep links keep serving. `apps/portfolio-web/tests/content-fetch.test.ts` asserts the classification. |
| Work on UI details under the archive | `apps/portfolio-web/src/components/pages/projectsPage/ProjectArchive.tsx`, `apps/portfolio-web/src/components/pagination/CursorPaginationControls.tsx` | Start with `apps/portfolio-web/tests/project-archive-cursor.test.tsx` for cursor behavior during row interactions or `apps/portfolio-web/tests/pagination-layout.test.ts` for navigation clearance. These do not measure rendered layout in a browser. |

A representative cross-workspace request is the project archive. The browser
calls `${VITE_API_URL}/v2/projects/archive` with a limit and an opaque cursor.
The API registers that route in `workers/portfolio-api/src/entrypoint.ts`, the
controller parses the query, and the model keysets on
`(COALESCE(display_order, 0), id)` with a `limit + 1` probe to decide
`has_more`. The web side restates the response as a local interface and maps
snake_case rows into the view model in `apps/portfolio-web/src/components/pages/projectsPage/Projects.tsx`.
A field or pagination change therefore touches the API model, the controller
response, and that local interface together; the web tests do not import the
API types, so nothing fails on drift alone.

A representative SEO route is `/sitemap.xml`. The middleware handles it before
the allowlist, `apps/portfolio-web/src/data/sitemap.ts` builds the URL set from
static routes plus snippet documents fetched through the cached content helper,
and the last-known-good copy is an edge cache entry rather than a header
promise. Indexability decisions come from `apps/portfolio-web/src/data/canonicalRoutes.ts`;
`apps/portfolio-web/tests/sitemap.test.ts` and
`apps/portfolio-web/tests/route-indexability.test.ts` are the narrow checks,
and the preview image generator is `apps/portfolio-web/scripts/generate-social-previews.ts`.

Local scope: Vite serves the app alone, while the Pages runtime needs a build
first because it serves `dist` and discovers Functions from the workspace root.
Use the root development aliases rather than inventing a second command. Pages
serving is not evidence that the Worker routes behave.

## Portfolio API

| Task | Start here | Trace and verify |
| --- | --- | --- |
| Add or change a public read route | `docs/api/routes.md`, `workers/portfolio-api/src/entrypoint.ts`, `workers/portfolio-api/src/controller/` | Registration order is the contract: public GETs are mounted before the private middleware block, so a route added below it is private by accident. Follow the controller into its model and check `workers/portfolio-api/tests/public-boundary.test.ts`. |
| Change a write route or the admin gate | `workers/portfolio-api/src/entrypoint.ts`, `workers/portfolio-api/src/controller/`, `workers/portfolio-api/src/utils/serverErrors.ts` | Writes require the server-held internal header. Without it, the middleware returns 410 for a configured browser origin and 403 for an untrusted or missing origin. Start with `workers/portfolio-api/tests/write-boundary.test.ts` for that split, or `workers/portfolio-api/tests/admin-contracts.test.ts` for payload validation after the gate. |
| Change a paginated archive contract | `workers/portfolio-api/src/controller/ProjectsPageController.ts`, `workers/portfolio-api/src/model/ProjectsPageModel.ts`, `workers/portfolio-api/src/controller/CertificatesPageController.ts`, `workers/portfolio-api/src/model/CertificatesPageModel.ts` | Both archives are controller-then-model pairs. Limit bounds, rejected offset mode, and the response envelope live in the controller; cursor encode/decode lives in the model, which is what the tests import. `workers/portfolio-api/src/controller/CertificatesPage/CertificatesController.ts` is certificate CRUD, not the archive — do not edit it for paging. Cursor version bumps invalidate cursors already held by the browser. Verify with `workers/portfolio-api/tests/project-pagination.test.ts` and `workers/portfolio-api/tests/certificate-pagination.test.ts`. |
| Change a table, index, or migration | `workers/portfolio-api/src/db/schema.ts`, `workers/portfolio-api/migrations/`, `docs/database/migrations.md`, `docs/database/drizzle.md` | Drizzle owns typed schema; generated SQL files are applied in order and recorded. Keyset paging depends on the paired display-order index migrations, so a new ordering column needs both the normalizing backfill and the index. |
| Change media upload, read, or deletion | `workers/portfolio-api/src/controller/Media/MediaController.ts`, `workers/portfolio-api/src/bindings.ts`, `workers/portfolio-api/wrangler.toml` | R2 is reached through the bucket binding for reads and writes and through signed URLs for browser uploads; public URLs come from the CDN variable. Verify with `workers/portfolio-api/tests/media-presign.test.ts`. |
| Change the public snippet or home aggregate | `workers/portfolio-api/src/controller/SnippetsPage/SnippetsPageController.ts`, `workers/portfolio-api/src/model/SnippetsPage/SnippetsPageModel.ts`, `workers/portfolio-api/src/controller/HomePageController.ts` | For snippet previews, start with `apps/portfolio-web/tests/snippet-preview.test.ts`: it imports the API excerpt helper and covers truncation and fences, but not the HTTP response or R2. For the cacheable home aggregate, use `workers/portfolio-api/tests/homepage.test.ts`; that suite does not exercise snippets. |
| Change error responses or redaction | `workers/portfolio-api/src/utils/serverErrors.ts` | Error bodies are client-facing, so redaction of credentials and sensitive query values belongs here. Verify with `workers/portfolio-api/tests/server-errors.test.ts`. |

Storage ownership: the Worker binds one D1 database and one R2 bucket in its
Wrangler config, and `workers/portfolio-api/src/bindings.ts` is the typed list a
handler may rely on. Models receive the database; only the snippet and media
paths reach the bucket. Nothing here owns authentication state, which lives in
`workers/portfolio-public-auth/` and its migrations.

Schema history and bootstrap content are different things.
`workers/portfolio-api/migrations/` is applied history; the seed file under
`workers/portfolio-api/src/data/` is bootstrap content and must not be replayed
as a migration. Applying migrations locally and applying them remotely are
separate, separately authorized actions: a passing typecheck says nothing about
either.

Local scope: run the Worker through its workspace manifest, and check the
manifest for the exact script names before quoting them. Migration listing and
generation are read-only or file-producing; application is not. For request
shapes, read the controller and the web consumer together, since the web
workspace keeps its own copy of the response interface.
