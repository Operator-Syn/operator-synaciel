---
title: Syn-Forge SEO action plan
aliases:
  - SEO action plan
tags:
  - operations
  - seo
role: plan
---

# Syn-Forge SEO action plan

Audit date: 2026-11-19 · Site: https://syn-forge.com · Source: `apps/portfolio-web`

This note is the source of truth for the SEO work. Update it in the same change
that alters an item's state; [[operations/seo-phase-2|SEO phase 2]] carries the
design rationale while this note carries the state.

Status: **Phase 1 and Phase 2 deployed; Phase 3 item 3.1 merged to `main` (`50b6304d`) and awaiting a Pages redeploy.** Phase 2 shipped on 2026-11-21 in 63
one-path commits, `f3156ad7`..`34e30fe1`; Pages `operator-synaciel` redeployed
from `main` and the Worker deploy gate passed. Live verification after the
release: all seven public routes serve their `prerender-body` fragment and `h1`;
`/prerender/projects.html` is `404`; the self-hosted fonts are `200`;
`/netbird` keeps `x-robots-tag: noindex, follow`; `/projects` shows
`[ 8 projects ]` with a five-link footer and no leftover fragment after
hydration; `/certificates` shows `[ 9 certifications ]` with every certificate
on the padded `768×569` canvas except the `placehold.co` placeholder card.

Phase 1 history: on 2026-11-20 Cloudflare confirmed the canonical
production Pages deployment `c0ad38d9-9b6c-42d5-ad3f-43e32db84047` succeeded at
[`8ff55f79`](https://github.com/Operator-Syn/operator-synaciel/commit/8ff55f79e62871ac7649e5dc84cd35c042b6dbf5),
which adds the snippet publication date on top of the folder-routing release
[`5b1ea764`](https://github.com/Operator-Syn/operator-synaciel/commit/5b1ea76482548bfc970599fd38b77278780e5431).
Pages deploys directly from `main`; the separate [GitHub release workflow](https://github.com/Operator-Syn/operator-synaciel/actions/runs/44655665703)
passed validation and skipped all four Worker deploy jobs. The earlier
[2026-11-19 cleanup run](https://github.com/Operator-Syn/operator-synaciel/actions/runs/44550832020)
did redeploy all four Workers.

The dated matrices below preserve earlier observations. The 2026-11-20 smoke
checks cover the snippet rollout, not a fresh audit of every Phase 1 item.

Ordered by leverage. Each item names the file that owns it so it can be handed
to an implementation pass.

---

## Phase 1 — Critical technical fixes (week 1)

These fix index quality and remove the biggest ceilings. They are small,
local changes.

### Phase 1 status — 2026-11-19 baseline, snippet routing updated 2026-11-20

| Item | Status | Evidence |
|---|---|---|
| 1.1 Real 404s / route control | ✅ Deployed | The 2026-11-19 baseline covers generic misses, document misses, and folder routes. On 2026-11-20, Pages switched to a D1-first folder check; the invented-folder smoke test returned `404` + `X-Robots-Tag: noindex`. See item D for fallback behavior and evidence. |
| 1.2a Static slash / case | ✅ Deployed | `/projects/`, `/projects//`, `/PROJECTS`, `/ai///`, `/snippets/` → 308 to the no-slash form |
| 1.2b Snippet folder canonical | ✅ Deployed | Live: `/snippets/Database%20Practices/` → `308` → `/snippets/Database%20Practices`; invented paths `404` in both forms and never redirect; footer copy corrected to no-slash. |
| 1.3 Snippet metadata / existence | ✅ Deployed | Doc 22 → `Database Migrations — Code Snippets \| Syn-Forge`; live HTML carries `article:published_time` (`2026-06-11T14:28:59.000Z`, from D1 `created_at`), `article:modified_time` (`2026-06-11T14:46:14.000Z`) and JSON-LD `datePublished`; `/snippets/document/999999/…` → 404. Omitted, never back-filled from `modified`, when the binding or read fails. Deployed at `8ff55f79` on 2026-11-20. |
| 1.4 Server-rendered JSON-LD | ✅ Complete | Home `ProfilePage`+`Person`+`WebSite`; archives `CollectionPage`+`ItemList`; docs `TechArticle`+`BreadcrumbList`; static shell has 0 blocks |
| 1.5 Headers / caching / sourcemaps | ✅ Complete | Immutable assets, `sourcemap: false`, HSTS, CSP-Report-Only, Permissions-Policy. Cloudflare Transform Rule removes `X-XSS-Protection`/`Expect-CT` on HTML; bucket has immutable `Cache-Control` + a Cache Rule; GET is `cf-cache-status: HIT` |
| 1.6a Sitemap cache + utility exclusion | ✅ Deployed | Live sitemap is 10 `<loc>`, excludes `/netbird`, `/atelier`, `/agent`, and returns the 1.6 `Cache-Control`. **Correction 2026-11-25:** the live count is now 8 `<loc>` — the Phase 2 data cleanup left one snippet document, not three — and item 3.1 takes it to 15 once deployed. |
| 1.6b Static `<lastmod>` + last-known-good | ✅ Deployed | Live: `curl -s https://syn-forge.com/sitemap.xml | grep -o '<lastmod>' | wc -l` → `10` (7 static + 3 documents; **8 today**, 7 static + 1 document, and 15 `<loc>` once item 3.1 deploys), with 10 `<loc>`. Cold edge returns `503` + `Retry-After: 60`. The last-known-good branch now defaults to `caches.default`, so a warm edge serves the cached copy; it is only observable during an API failure, so its behaviour is proven by the stubbed test rather than by a live request. |
| 1.7 Utility noindex | ✅ Complete | `X-Robots-Tag: noindex, follow` on `/netbird`, `/atelier`, `/agent`; the sitemap excludes them — 10 URLs when this was written, **8 today** (7 static + 1 snippet document) and 15 once item 3.1 deploys; `/ai` stays indexable |
| 1.8 Sitemap resubmit + baseline | ✅ Complete | GSC sitemap resubmitted 2026-11-19T07:01Z, 10 URLs, 0 warnings, 0 errors; drift baseline captured |
| 1.9 Spam link review | ✅ Reviewed | Moz list reviewed; no disavow applied (recommended: monitor, don’t buy links) |

**Resolved (1.5):** asset-layer responses carried `access-control-allow-origin: *`
on `/assets/*`, `/cursors/*`, `/cf-fonts/*`, `/.well-known/*`, `llms.txt`,
`robots.txt` and the other excluded paths — including on misses, which come back
`404`, `content-type: text/html`. The middleware never sees excluded paths, so
the remedy was a zone rule, not code. Added a Cloudflare response header Transform
Rule on zone `syn-forge.com` (ruleset `8b27936b9ee6404ea48d6d34949431e3`, rule
`42a7f6389a534e7483cca4ce8a1c0cde`, "Remove CORS advertisement from every 404 on
the Pages hosts"):

```
(http.host eq "syn-forge.com" or http.host eq "www.syn-forge.com")
and http.response.code eq 404
→ remove access-control-allow-origin
```

The rule keys on status, not on a path list, so it covers every current and
future `_routes.json` exclude without needing an update when one is added.
`http.response.code` is evaluated in the response phase, so only misses lose the
header; 200 responses keep it. Verified live 2026-11-19 15:35 UTC: `/assets/nope.js`,
`/cursors/nope.css`, `/cf-fonts/nope.woff2`, `/.well-known/ai-catalog.json`,
`/llms-full.txt`, and `/wp-sitemap.xml` all return `404` with no
`access-control-allow-origin`; `/assets/index-7P2q3Cno.css`, `/robots.txt`, and
`/social-image.png` still return it on `200`. Collateral checks: the API host
`personal-portfolio.syn-forge.com` and the bucket host
`personal-portfolio-bucket.syn-forge.com` are outside the rule's host match and
are unaffected, and the pre-existing rules on the same ruleset (HTML
`X-XSS-Protection`/`Expect-CT` removal, immutable `Cache-Control` for the bucket)
still apply.

**Historical acceptance matrix — 2026-11-19, before the D1 rollout**

`wrangler pages dev dist` against the working tree, with `VITE_API_URL` set:

```
/snippets/Database%20Practices                 200
/snippets/Database%20Practices/                308 -> /snippets/Database%20Practices
/snippets/Dummy%20Folder                       200
/snippets/Dummy%20Folder/                      308 -> /snippets/Dummy%20Folder
/snippets/invented-xyz                         404 + x-robots-tag: noindex
/snippets/invented-xyz/                        404 + x-robots-tag: noindex
/snippets/root/database/migrations/            404
/snippets/document/22/database-migrations.md   200
/snippets/document/999/fake.md                 404
/snippets                                      200
/snippets/                                     308 -> /snippets
/projects/                                     308 -> /projects
/PROJECTS                                      308 -> /projects
/nope-xyz                                      404 + x-robots-tag: noindex
```

Sitemap local: `10` `<loc>…<lastmod>` pairs, `200 application/xml`.
Sitemap cold edge: `503 text/plain; charset=utf-8`, `cache-control: no-store`,
`retry-after: 60`. Warm edge: `200`, `x-sitemap-fallback: last-known-good`,
`cache-control: no-store`.

Live re-check on `https://syn-forge.com` after the 358-commit cleanup push
(deploy run `44550832020`):

| Request | Result |
|---|---|
| `/snippets/Database%20Practices` | `200` |
| `/snippets/Database%20Practices/` | `308` → `/snippets/Database%20Practices` |
| `/snippets/Dummy%20Folder` | `200` |
| `/snippets/Dummy%20Folder/` | `308` → `/snippets/Dummy%20Folder` |
| `/snippets/invented-xyz`, `/snippets/invented-xyz/` | `404` + `x-robots-tag: noindex` |
| `/snippets/root/database/migrations/` | `404` + `x-robots-tag: noindex` |
| `/snippets/document/22/database-migrations.md` | `200`, title `Database Migrations — Code Snippets | Syn-Forge` |
| `/snippets/document/999/fake.md` | `404` + `x-robots-tag: noindex` |
| `/snippets/` | `308` → `/snippets` |
| `/projects/`, `/PROJECTS`, `/ai///` | `308` to the no-slash, lowercase form |
| `/nope-xyz` | `404` + `x-robots-tag: noindex` |
| `/sitemap.xml` | `200 application/xml`, 10 `<loc>`, 10 `<lastmod>`, `cache-control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` |

Checks: `npm run typecheck` 0; `npm run test --workspace=@syn-forge/portfolio-web`
**191/191**; `npm run lint` (ESLint) 0; repo-wide `npm run check:biome` clean;
build pass. The shared deployment-path test now lives at
`scripts/tests/deployment-paths.test.ts`.

The sitemap's last-known-good cache now defaults to `defaultCache()` in
`sitemap.ts`; the production call site no longer depends on an injected cache. A
test stubs `globalThis.caches.default` and asserts the last-known-good write.

The folder route decision is the pure `decideSnippetFolderRoute`; tests cover
serve / not-found / redirect, so an inverted existence check fails the suite
rather than merely changing a source-text match.

**Cloudflare configuration applied (2026-11-19, not repo code)**

- **A. Legacy headers — resolved.** Response-header Transform Rule
  `f360bde08cc04edea28bee86117bc2ac` in ruleset
  `8b27936b9ee6404ea48d6d34949431e3` removes `X-XSS-Protection` and `Expect-CT`
  for `syn-forge.com` and `www.syn-forge.com`. Verified absent on `/`,
  `/projects`, `/ai`, `/netbird`, snippet docs, and 404s; HSTS,
  CSP-Report-Only, and Permissions-Policy remain.
- **B. Image bucket — resolved.** Response-header rule
  `3a07411d80644550a604fea96bca2abb` sets
  `Cache-Control: public, max-age=31536000, immutable` for image extensions on
  `personal-portfolio-bucket.syn-forge.com`. Cache Rule
  `9e343317c10b48098294e93538f39ec5` in ruleset
  `9a336ee47da4478b9f1f6e1be684bde2` makes it cacheable. GET returns
  `cf-cache-status: HIT` with an `age`; HEAD returns `DYNAMIC` and is not a valid
  cache probe.

**Remaining notes**

- **C. Sitemap lastmod / cold-start fallback — deployed 2026-11-19.**
  Static routes take checked-in dates from `contentDates.ts`; `/snippets` uses the
  newest document `modified`. A warm edge serves the cached last-known-good `200`;
  a cold edge returns `503` + `Retry-After: 60` instead of the previous
  static-routes `200`. Full durable last-known-good across cold edges still needs
  KV/R2; that is not claimed. Live the deployed sitemap returns `200` with 10
  `<loc>`/`<lastmod>` pairs and the long-lived `cache-control`; the `503` branch
  is only observable on a cold edge during an API failure and was not exercised.
- **D. Unknown `/snippets/<folder>` paths — D1-first fix deployed 2026-11-20.**
  The 2026-11-19 version depended on the cached API tree. Pages now uses
  `snippetFolderProbe.ts` to query the existing `Snippets` table through
  `SNIPPET_DB`, bound to `my-personal-portfolio` in Production only. A confirmed
  miss returns `404` with `X-Robots-Tag: noindex`; a confirmed folder serves or
  redirects to its no-slash URL. Only an inconclusive D1 lookup falls back to the
  existing API lookup; if that is inconclusive too, Pages still serves the shell.
  No production migration or data write was needed.

  **Production GET smoke tests — 2026-11-20:**

  | Request | Observed result |
  |---|---|
  | `/snippets/deploy-check-nonexistent-5b1ea764` | `404` + `X-Robots-Tag: noindex` |
  | `/snippets/Database%20Practices` | `200` |
  | `/snippets/Database%20Practices/` | `308` → `/snippets/Database%20Practices` |
  | `/snippets/root` | `308` → `/snippets` |
  | `/snippets/social-image.png` | `200` |
  | `/snippets/root/database/migrations/` | `404` + `X-Robots-Tag: noindex`; not a real-folder test case |

  **Isolated Wrangler Pages test:** with the API unreachable and disposable D1
  fixtures, `/snippets/no-such-fixture` returned `404` + `noindex` with
  `SNIPPET_DB` bound, versus `200` without it. Real root and nested fixtures
  returned `200` and their slash variants redirected with `308` when bound.
  This test isolates the D1 behavior; production smoke tests verify routing
  without inducing an outage or proving which lookup answered each request.


### 1.1 Return real 404s and control every route

**Current status:** real 404s and route control shipped on 2026-11-19. The folder
check was upgraded to D1-first on 2026-11-20; see item D above.

**Why:** every unknown path returns `200 text/html` with the SPA shell. Google
can index unlimited invented URLs, and agent/well-known probes get false
positives (`/llms-full.txt`, `/.well-known/ai-catalog.json`, `/sitemap_index.xml`,
missing `/assets/*.js`). Nested unknown paths (`/projects/garbage-xyz`) even get a
self-referential canonical.

**Change:**
- Add `apps/portfolio-web/public/404.html` (static, `noindex`, links home /
  projects / snippets / ai; no dependency on the JS bundle).
- Expand `apps/portfolio-web/public/_routes.json` to `"include": ["/*"]`, keep
  the existing `exclude` entries and add `/404.html`, `/index.html`.
- In `apps/portfolio-web/functions/_middleware.ts`:
  - Allowlist `/`, the ten static routes, and
    `/^\/snippets\/document\/\d+\/[^/]+$/`.
  - Serve `env.ASSETS.fetch(new URL("/index.html", request.url))` for allowed
    routes instead of relying on SPA fallback.
  - Return `404.html` with `status: 404` and `X-Robots-Tag: noindex` for
    everything else.
  - 301 case variants of known routes to lowercase (`/PROJECTS` → `/projects`).

**Verify:** `/` and all ten routes 200; `/projects/`, `/projects//`, `/PROJECTS`,
`/sitemap_index.xml`, `/.well-known/ai-catalog.json`, `/assets/nope.js` behave as
308/301/404 as appropriate.

**Original route-control release — 2026-11-19 (historical commits and checks).**

| Commit | Path |
|---|---|
| `4baf4309` | `.gitignore` — ignore this audit workspace |
| `d55403a1` | `apps/portfolio-web/public/404.html` (new, `noindex`, no JS) |
| `9cd3b618` | `apps/portfolio-web/public/46c433f7dfe14ebe9a009d6eee3865bb.txt` (IndexNow key) |
| `ecd430c8` | `apps/portfolio-web/public/_routes.json` — `include: ["/*"]` + 22 excludes |
| `157f4b65` | `apps/portfolio-web/functions/_middleware.ts` — route classification, explicit `index.html`, real 404, 301 case fold |
| `a7cf50fe` | `tests/portfolio-web/pages-assets.test.ts` |
| `04f5ce48` | `tests/portfolio-web/sitemap.test.ts` |
| `b6f0ddcd` | `tests/portfolio-web/social-preview.test.ts` |

Each commit is one path; `scripts/validate-commit.ts` enforced it.

Verified:

- `npm run typecheck` — pass
- `npm run test --workspace=@syn-forge/portfolio-web` — **138/138 pass**
- `npx biome check` on the changed files — pass
- `wrangler pages dev dist` route matrix, before commit:
  - known routes `200` with the server head rewrite intact
  - `/projects/garbage`, `/nope`, `/sitemap_index.xml` → `404` +
    `X-Robots-Tag: noindex`
  - `/PROJECTS` → `301` `/projects`
  - `/projects/`, `/projects//` → `200` (1.2 not started at the time)
  - snippet slash redirects still `308`
  - `/sitemap.xml` → `200`; `/llms.txt`, `/robots.txt`, IndexNow key →
    `200 text/plain`; Yandex extensionless verification file → `200`

Preserved:

- `/yandex_45d261b4fb614693` excluded so the Yandex verification file still works
- IndexNow key excluded and served `200 text/plain`

Known limits / follow-ups:

- **1.1's own `Verify` line demanded `308` for `/projects/` and `/projects//`,
  which is a 1.2 criterion.** It was not met when 1.1 was marked done, and is
  met only as of `73bf386c`. The item was marked done against a criterion it
  could not satisfy.
- **The allowlist broke `/snippets/<folder>/` — fixed.** Only
  `/snippets/document/:id/:slug` was accepted under `/snippets/`, so the folder
  URLs `Snippets.tsx` generates returned `404` on direct load. Resolved in
  `b7fe48ef` by extracting `functions/routePolicy.ts` and accepting any path under
  `/snippets/`. That widening initially let invented folders return `200`.
  The existence check in item D now returns a real `404` on a confirmed miss.
- **Snippet document existence — fixed.** `/snippets/document/999999/…` returns
  `404`. The check shipped with item 1.3 (`classifyContentExistence` in
  `functions/contentFetch.ts`), so the earlier note here that nonexistent ids still
  return `200` no longer holds. Replaced rather than deleted so the correction is
  visible to anyone who read the older version.

- Excluded static misses are served by the asset layer, not the middleware: `404`,
  `content-type: text/html`, no `X-Robots-Tag`. They used to advertise
  `access-control-allow-origin: *` as well; the zone-level rule recorded under
  1.5 now strips that header from every `404` on `syn-forge.com` and
  `www.syn-forge.com`, so `/assets/nope.js`, `/cursors/nope.css`,
  `/cf-fonts/nope.woff2`, `/.well-known/ai-catalog.json`, `/llms-full.txt`, and
  `/wp-sitemap.xml` all return `404` without it.
- `/.nojekyll` and `/_routes.json` now `404` — neither excluded nor a known
  route. Treated as intentional.
- Any new static file must be added to `_routes.json` excludes, or it will be
  treated as an unknown route.
- The sitemap keeps its 4 s API timeout. Caching and the static `<lastmod>` from
  item 1.6 are committed and deployed; see the live matrix.

### 1.2 Normalize trailing slashes everywhere

**Deployed 2026-11-19; rechecked for item D on 2026-11-20:** the real folder's
slash variant returned `308` to no-slash and the invented test folder returned `404`.

**Why:** `/projects/`, `/certificates/`, `/ai/`, `/netbird/`, `/atelier/`,
`/agent/`, `/privacy-policy/`, `/terms-and-conditions/` all return `200` with a
self-referencing canonical. Only snippets normalize today.

**Change:** generalize `apps/portfolio-web/functions/canonicalRedirect.ts` to
strip trailing slashes and collapse `//` for every known route (308).

**Status — static slash/case normalization and the no-slash snippet folder canonical are both deployed 2026-11-19.**

Commit: `73bf386c` — `apps/portfolio-web/functions/canonicalRedirect.ts` only
(30 insertions, 7 deletions). Implemented with a one-file constraint, so no test
or middleware change was made.

Behaviour: lowercase the path, collapse repeated slashes, strip trailing
slashes (leaving `/` alone), map `/snippets/root` → `/snippets`, then return
`308` only when the result is a known static route (from `SITEMAP_STATIC_ROUTES`
plus `/`) or matches `/^\/snippets\/document\/\d+\/[^/]+$/` and differs from the
request. Only the pathname is replaced, so query strings and hashes survive.

Verified — real `tsx` execution of the exported function, not assertion:

```
/projects/           308 -> https://syn-forge.com/projects
/projects//          308 -> https://syn-forge.com/projects
/PROJECTS            308 -> https://syn-forge.com/projects
/PROJECTS/           308 -> https://syn-forge.com/projects
/ai///               308 -> https://syn-forge.com/ai
/AI/                 308 -> https://syn-forge.com/ai
/snippets/root/      308 -> https://syn-forge.com/snippets
/snippets/document/3/README.md   308 -> .../3/readme.md
/projects/?page=2    308 -> https://syn-forge.com/projects?page=2
//                   308 -> https://syn-forge.com/
/ , /?x=1 , /nope-garbage , /nope-garbage/   null
/snippets/some-folder/                       null
/snippets/root/database/migrations/          null
```

- `npm run typecheck` — pass
- `npm run test --workspace=@syn-forge/portfolio-web` — **138/138 pass**
- `npx biome check apps/portfolio-web/functions/canonicalRedirect.ts` — pass

Known limits / follow-ups:

- **Case normalisation moved, and 1.1's 301 became a 308 — resolved.** The dead
  `createCaseVariantRedirect` and the duplicated `KNOWN_STATIC_ROUTES` /
  `SNIPPET_DOCUMENT_ROUTE` were deleted from `_middleware.ts` in `b7fe48ef`;
  route classification now lives only in `functions/routePolicy.ts`
  (`1de2516a`). Case variants are `308` from `canonicalRedirect`, single hop.
  This is recorded as a behaviour change from 1.1, not a regression.
- **`/snippets/<folder>/` 404 — resolved** in `b7fe48ef` by widening the
  allowlist. `/snippets/root/database/migrations/` still returns `null` from
  `createCanonicalRouteRedirect`, which leaves the existence decision to the
  middleware. The live path returns `404`; helper `null` does not imply `200`.
- **Slash/case normalization is now tested.** `apps/portfolio-web/tests/canonical-routes.test.ts`
  asserts `/projects/`, `/projects//`, `/PROJECTS/`, and `/ai///`; the middleware
  route matrix covers snippet folder slash variants and invented-path 404s.
- Lowercasing is safe for snippet document slugs only because
  `slugifySnippetName` already lowercases them
  (`apps/portfolio-web/src/components/pages/snippetsPage/snippetRoutes.ts:4-23`).
  A slug builder that stopped lowering would make this rewrite real URLs.

### 1.3 Unique server-rendered metadata for snippet documents

**Why:** all three sitemap document URLs serve
`Code Snippets | Syn-Forge` and the snippets archive description. Only client JS
makes them unique, so non-JS crawlers and social scrapers see duplicates.

**Change:** in `apps/portfolio-web/src/data/socialPreview.ts` (or the
middleware), derive title/description for
`/snippets/document/:id/:slug` from the slug: `database-migrations.md` →
`Database Migrations — Code Snippets | Syn-Forge`. If the API call is acceptable,
fetch `/v2/snippets/:id` with a short `cf.cacheTtl` for the real name and the
first paragraph. For date metadata, emit `article:modified_time` from the snippet's
`modified` value and `article:published_time` from the row's `created_at`, which is
the upload event because a snippet is public as soon as it is uploaded
(`functions/snippetDocumentDates.ts`). Never fill `article:published_time` from the
modification date, and omit it when the read fails.

### 1.4 Emit page-level JSON-LD in the server response

**Why:** raw HTML only carries the static `Person` block. `TechArticle`,
`CollectionPage`, `BreadcrumbList`, and `WebSite` exist only after JS, so
non-JS crawlers never see them.

**Change:** inject per-route JSON-LD in `functions/_middleware.ts` alongside the
existing head rewrite (or have the prerender step write it). Coordinate with
`GlobalHeadManager` so nodes are not duplicated. Recommended graph:
- `/` → `ProfilePage` + `Person` (`@id`) + `WebSite`
- `/projects`, `/certificates`, `/snippets` → `CollectionPage` + `ItemList`
- `/snippets/document/:id/:slug` → `TechArticle` + `BreadcrumbList` + `author`
- legal pages → `WebPage`
- `/ai` → `WebPage` + `SoftwareApplication` (MCP)

### 1.5 Headers, caching, and source maps

**Change:**
- Add `apps/portfolio-web/public/_headers`:
  ```
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  /cursors/*
    Cache-Control: public, max-age=31536000, immutable
  /social-image.png
    Cache-Control: public, max-age=604800
  ```
- Set on HTML responses from the middleware (Function responses do not reliably
  inherit `_headers`):
  `Strict-Transport-Security`, `Content-Security-Policy` (start report-only),
  `Permissions-Policy`; drop `X-XSS-Protection`, `Expect-CT`, and
  `Access-Control-Allow-Origin: *` on HTML.
- Set `build.sourcemap: false` in `apps/portfolio-web/vite.config.ts`; the live
  3.5 MB `index-*.js.map` is public.
- Add `Cache-Control: public, max-age=31536000, immutable` to the
  `personal-portfolio-bucket.syn-forge.com` image responses (currently
  `cf-cache-status: DYNAMIC`, no cache header, 184 KB WebP re-fetched).

### 1.6 Sitemap hygiene

- Add `<lastmod>` to static routes.
- Cache the sitemap (`public, max-age=300, s-maxage=3600,
  stale-while-revalidate=86400`) and serve last-known-good instead of `503` when
  the API is down (`apps/portfolio-web/src/data/sitemap.ts`).
- Remove utility pages from the sitemap if they are marked `noindex` (see 2.2).

### 1.7 Decide indexability of utility pages

`/netbird`, `/atelier`, `/agent` are Google-verification/app-note pages with
360–505 words and no search demand. Mark them `noindex, follow` at the server
level and drop them from the sitemap. Keep `/ai` indexable — it is the only
page explaining the MCP.

### 1.8 Resubmit the sitemap and set the baseline

GSC currently reports 13 submitted URLs, 0 errors, last submitted 2026-09-24.
Resubmit after the Phase 1 changes, then check again after Phase 2. Keep the
90-day baseline (6 clicks / 426 impressions / 1.41% CTR / position 7.0) for
comparison.

**Status — done 2026-11-19 (owner).** Resubmitted after the deploy of
`12665903..9f55490a`. The sitemap now lists 10 URLs, down from 13, because
`/netbird`, `/atelier` and `/agent` were withheld by item 1.7. Read nothing into
the numbers for 2–4 weeks; the baseline above is the comparison point.

### 1.9 Review the spam link profile

Moz reports DA 3, 66 referring root domains, and anchors such as “buy backlinks
online cheap” and “premium PBN network service”. These are not editorial links.
Review GSC → Links, and consider a cautious disavow only after manually checking
each domain — disavow is easy to over-apply. Do not buy links.

**Status — CLOSED 2026-11-19. Verdict: no disavow, no action. The Moz spam
profile is not corroborated by Google.**

Evidence: GSC → Links for the `sc-domain:syn-forge.com` property.

```
External links  Total: 1
  Top linked pages     https://syn-forge.com/          1
  Top linking sites    cloudflare.com                  1
  Top linking text     syn forge com
Internal links  Total: 9
  https://syn-forge.com/              3
  https://syn-forge.com/certificates  3
  https://syn-forge.com/projects      3
```

The single external link is the owner's own Cloudflare API support thread from
2026-03-16, posted as `operator-syn`; the domain appears inside a pasted Certbot
error (`Unable to determine zone_id for arsi.syn-forge.com …`), not as a placed
link with a real anchor.

**Why this settles it:** a disavow file only influences how Google treats links
Google has already discovered. Google has discovered one, and it is benign. A
disavow file for this property would have nothing to put in it. The Moz figures
(DA 3, 66 referring root domains, “buy backlinks online cheap”, “premium PBN
network service”) are third-party crawl data; none of those anchors or domains
appear in Google's index for this property. Disavowing links Google does not know
about has no effect, and the risk of over-applying it is real while the upside is
zero.

**Secondary finding worth carrying into Phase 2:** 9 internal links total across
the whole site, 3 each on `/`, `/certificates` and `/projects`, and nothing for
`/snippets`, `/ai`, `/privacy-policy` or `/terms-and-conditions`. A ten-page site
with a nav bar should show far more than that. It corroborates the core Phase 2
diagnosis — the raw shell carries no links and the SPA's navigation only becomes
visible after JS — and it is direct evidence for item 2.6.

Do not buy links, and do not revisit this item unless GSC's external link count
moves.

---

## Phase 2 — Rendering and on-page (weeks 2–3)

**Status 2026-11-21: every item in Phase 2 is written, gated and deployed.** Seven increments passed both gate stages:
metadata (2.7), archives/linking/headings (2.3 pagination, 2.6, 2.2 H1 and alt), types and assets (2.5 fonts,
2.3 drawer, 2.2 home H1, clock visibility), images (2.4 project media and portrait), certificate normalisation
(2.4), pre-render (2.1), and the production snippet cleanup (2.3 data). **No implementation item in this phase
remains open.** Released to production the same day: 63 one-path commits pushed from `f3156ad7` to `34e30fe1`, Pages
`operator-synaciel` redeployed, and the Worker deploy gate green. Live verification after the release — all
seven public routes serve their fragment and `h1`; `/prerender/projects.html` is `404`; self-hosted fonts are
`200`; `/netbird` keeps `x-robots-tag: noindex, follow`; `/projects` shows `[ 8 projects ]` with the five-link
footer that version shipped; `/certificates` shows `[ 9 certifications ]` with every certificate on the padded
canvas except the `placehold.co` card.

Two follow-up changes landed after that release and are committed and pushed at `b14e2f95`..`ffc13405`, without a
live re-check: the footer became one utility line with its own copyright and both legal links (seven links total),
and both archives now restore their saved scroll position after the rows render. The Pages spec covers both; the
2026-11-21 live matrix above predates them.

What remains is one visual check nobody has performed: the narrow certificate card state (2.4). The pre-render
transition under throttling was measured on 2026-11-21 and closed — with JS disabled every route renders its own
`h1`, lead and links; with JS at 4× CPU throttle and 500 kbit/s the fragment was gone before the first observable
animation frame and CLS measured 0, so the two-transition sequence does not happen in practice.

| Item | State | Evidence |
|---|---|---|
| 2.1 pre-render | **deployed** | build-time body fragments, not SSR: `scripts/prerender.ts` empties `public/prerender/`, writes one fragment per public route from `src/data/prerenderRoutes.ts`, and exits non-zero unless all seven exist; `vite build` copies them into `dist/`. The middleware fetches the matching fragment through `ASSETS.fetch` and injects it into `div#root` with one more `HTMLRewriter` handler, and `createRoot` discards it on mount. No `_routes.json` change: a direct `/prerender/*` request 404s through `isKnownRoute`, and the binding does not re-enter the Function. Headings, leads and the seven nav links need no network — a build with `VITE_API_URL` pointed at a closed port still writes all seven — and archive rows/counts are optional enrichment under a 5s timeout that cannot fail the build. Verified: 259 unit tests, 30 Pages tests (raw HTML carries the H1, a >40-char lead and all seven links; after hydration one `h1` and no fragment; `/prerender/projects.html` 404; HSTS and `x-robots-tag` unchanged), typecheck, Biome, ESLint, `docs:check`, build. **Visual/CLS check done 2026-11-21 on the live site:** with JS disabled all seven routes render their own `h1`, lead and seven links, and the archives render their rows and count; with JS at 4× CPU throttle and 500 kbit/s FCP was 3 472 ms, the fragment was already gone at the first observable animation frame, and CLS measured 0 — the fragment is a crawler-only surface, not a perceived-speed win. |
| 2.2 titles/descriptions | **deployed** | `socialPreview.ts` titles are 38–48 map / 52–59 emitted, five descriptions raised to 121–132; `GlobalHeadManager` defaults from the map and updates one description tag instead of appending a second |
| 2.2 H1s | **deployed** | `/snippets` renders a visible `h1` plus a `h2`-headed document list; the home `h1` is now the role line `Software developer building calm, dependable web systems` (`src/data/homeHeroCopy.ts`), rendered before the API resolves, with the owner's tagline moved to the kicker. Both D1 phrase fields stay in use |
| 2.2 image alt | **deployed** | `MediaRenderer` requires `alt` and all four call sites pass it; the portrait's alt now derives from the API's `Name` entry, with `loading="eager"` and its existing test untouched |
| 2.3 pagination | **deployed** | both archives fetch `12` per request (`PROJECTS_PER_PAGE`, `CERTIFICATES_PER_PAGE`), so the live 7 projects and 8 certificates render on one page; cursor controls are hidden only when there is nothing to page (`shouldShowArchivePagination`). Reload now preserves the archive's saved scroll position after the rows render, instead of letting the browser clamp it against the shorter loading skeleton and strand the reader at the bottom; a bottom position is preserved too — that restoration landed after the 2026-11-21 release (`7bccecbe`..`ffc13405`), so it is committed and pushed but outside that release's live check. Above 12 records the API cap still applies — the cursor is not looped |
| 2.3 Dummy Folder / `readme.md` | **done, 2026-11-20** | deleted from D1 `my-personal-portfolio`: `README.md` (id 3, the verbatim Vite template), `XQubit Handbook.pdf` (id 24, a 14-page third-party handbook — removed on the owner's instruction after judging it unsuitable snippet content, not because the file itself is poor), then the empty `Dummy Folder` (id 4). Their two R2 objects were deleted too. Verified: `/api/snippets` returns one folder with one document, `/snippets/document/22/database-migrations.md` is `200`, `/snippets/document/3/readme.md` and `/snippets/document/24/xqubit-handbook.pdf` are `404`, and `/sitemap.xml` lists only document 22. |
| 2.3 settings drawer | **deployed** | the panel body mounts on first open and stays mounted (`isOpen \|\| hasOpened`, derived in an effect so the compact dock's `openPanel` path is covered), so ~160 words of theme labels left every page's crawlable DOM while closing still animates a real body |
| 2.4 images / CLS | **deployed — all three surfaces** | project media `width=1360` and portrait `width=360` through `/cdn-cgi/image/…,format=auto,quality=78/` with `width`/`height`, `loading` by position, `fetchpriority="high"` on the portrait only, and a tested fallback to the original. Certificates are **normalised** rather than merely resized: `width=768,height=569,fit=pad,background=transparent` gives every card one canvas with nothing cropped, because the sources arrive at ratios from 0.71 to 1.41. Measured: projects 900 766 → 33 480 bytes, portrait 184 892 → 21 385, certificates 2 454 KB → 283 KB for eight. Outstanding: nobody has looked at the narrow 16/10 card state in a browser |
| 2.5 fonts / main thread | **deployed** | five self-hosted WOFF2 files (148 120 bytes, OFL licences committed) under `/fonts/`, excluded from the Function with an immutable cache rule; Google Fonts stylesheet and both preconnects removed, two preloads added. `Clock` ticks through `startVisibilityAwareTicker`, which stops while the tab is hidden |
| 2.6 internal linking | **deployed** | `SiteFooter` closes every page except `/` with a copyright line and seven links — the five product routes plus Privacy and Terms, the legal pair grouped apart; `/snippets` renders one `TransitionLink` per document, nested folders included, so the document URLs are reachable without JS-only folder navigation. The footer needed two corrections on 2026-11-21: it first shipped as five bare links with no identity, then grew a masthead with a wordmark and tagline that read as editorial furniture; the final single utility line is `b14e2f95`..`72616cc8`, committed and pushed after the release, so the release's live check saw the earlier five-link version |
| 2.7 CTR titles/descriptions | **deployed** | as 2.2; `/`, `/projects`, `/certificates`, `/snippets`, `/ai`, `/privacy-policy`, `/terms-and-conditions` rebuilt around the queries that already have impressions |

**Why 2.1 is not SSR:** the preferred design failed seven times and the reasons survived contact with the
current tree — `createRoot` rather than `hydrateRoot` (`src/main.tsx:3,21`), nine `lazy()` routes inside one
`<Suspense>` (`NavLinks.types.ts:11-12`, `App.tsx:52`), a portal built in a `useState` initialiser
(`FloatingControlsDock.tsx:27-30`), `Clock`'s `useState(new Date())`, `dist/index.html` doubling as the
snippet-document shell (`_middleware.ts:427`), headers and `noindex` existing only in the Function, and —
found during implementation — preloading a lazy module does not stop it suspending, so `renderToString`
emits the loading skeleton. The accepted design (route manifest, synchronous slot, shared `AppShell`, query
priming) would have rebuilt the app's rendering model to serve crawlers. The shipped design instead writes
fragments at build time and has the Function inject them, which reaches the same acceptance without touching
React. Recorded in `docs/operations/seo-phase-2.md`.

### 2.1 Pre-render the public routes (highest content leverage)

Googlebot renders JS, but Bing, AI crawlers, link unfurlers, and low-budget
crawlers do not. Today 100% of body text and links are JS-only.

**Built (2026-11-21): the interim design, because the preferred one is closed.**
SSG was attempted and rejected seven times; the six original reasons still hold
today — `createRoot` rather than `hydrateRoot`, nine `lazy()` routes inside one
`<Suspense>`, a portal created in a `useState` initialiser, `Clock`'s
`new Date()`, `dist/index.html` doubling as the snippet-document shell, and the
security/CSP/`noindex` headers existing only in the Function. A seventh was added
during implementation: preloading a lazy module does not stop React suspending,
so `renderToString` emits the loading skeleton.

So the shipped design is build-generated fragments plus middleware injection,
exactly as the interim fallback described. Copy lives in
`src/data/prerenderRoutes.ts` and the six page components import their headings
and leads from it, so the page and the fragment cannot drift; `HOME_HERO_BODY_FALLBACK`
moved into `homeHeroCopy.ts` for the same reason. `archiveCount.ts` formats
`[ N projects ]` for both the page header and the fragment after a double
increment was found and fixed there.

**Acceptance: met**, verified through the Pages runtime rather than by
inspection — raw HTML for all seven routes carries the H1, a lead paragraph
longer than 40 characters, and all seven internal navigation links inside
`#root`.

**Remaining:** one visual check, and it is not in 2.1. The pre-mount moment was measured on the live site on
2026-11-21 and the concern was closed: with JS disabled every route renders its own `h1`, lead, seven links and
— on the archives — its rows and count; with JS enabled at 4× CPU throttle and 500 kbit/s the fragment was
already gone at the first animation frame the tracker could observe, so the app's first paint is the first paint
and CLS measured 0. The two-transition sequence does not happen in practice. Two cosmetic limits survive rather
than get fixed: the fragment's `<nav>` renders as undifferentiated inline text that wraps after `AI`, and a
JavaScript-less home page carries no logo, footer or calls to action. Snippet-document bodies were already
server-rendered by the middleware and are unchanged.

### 2.2 On-page copy

- One descriptive `<h1>` per page. Home currently uses the tagline
  "Calm Interfaces, Seamless Experiences —"; keep the visual treatment but put
  a role/value proposition in the H1 (e.g. include "software developer" or the
  niche) and move the tagline to the kicker.
- Titles: 50–60 chars, front-load the topic; keep `| Syn-Forge` only when it
  fits. Current `/projects` (20), `/snippets` (25), `/netbird` (19),
  `/atelier` (19), `/agent` (26), `/privacy-policy` (26), `/ai` (29) are too
  short.
- Descriptions: 120–155 chars. Current `/projects` (41), `/agent` (70),
  `/netbird` (85), `/snippets` (88), `/atelier` (95), `/certificates` (97) are
  too short.
- Give every image meaningful `alt` text (profile is `alt="Profile"`), explicit
  dimensions, and `fetchpriority="high"` on the LCP image.

### 2.3 Fix pagination and placeholder content

- `/projects?page=2` returns page 1 with a self-canonical, so 4 of 8 projects are
  unreachable. Either render all items, or give pagination real, crawlable URLs
  with correct canonicals. Apply the same fix to `/certificates` (6 of 9 shown).
- Remove "Dummy Folder" from production snippet data.
- Remove or rewrite `/snippets/document/3/readme.md`; it is the verbatim Vite
  `react-ts` template README and is currently in the sitemap.
- Render the Appearance/settings drawer client-side only. It adds ~160 identical
  words to every page DOM (42–48% of the words on some routes), which LLM
  extractors read as page content.

### 2.4 Images and layout stability

- Generate AVIF/WebP variants and add `srcset`/`sizes` to the profile image
  (185 KB at 166 px) and project media (900 KB / 674 KB PNGs painted at 461×170).
  Target: profile ~15–20 KB, first `/projects` view ~150 KB.
- Add `width`/`height`, `loading="lazy"` below the fold, and
  `fetchpriority="high"` only on the true LCP image.
- Fix mobile CLS 0.120: the hero skeleton reserves `min-height` but not the final
  height. Either reserve per-breakpoint heights or bootstrap the data so no swap
  occurs (see 2.1).
- Replace `alt="Profile"` with descriptive alt text.

### 2.5 Main-thread and fonts

- Trim entry imports (31 `lucide-react` icons), split below-fold home sections,
  and stop the 1-second `Clock` interval when the tab is hidden. TBT is 464 ms on
  throttled mobile.
- Commit to one font delivery path: self-host subset WOFF2 in `public/fonts`,
  drop the Google Fonts `<link>` and both `preconnect`s, and preload the hero
  face. Fonts are currently ~209 KB discovered late, with both Google Fonts and
  `/cf-fonts` in play.

### 2.6 Internal linking

The raw shell has zero links. After pre-rendering, ensure every page links to
Projects, Snippets, AI, and About; link each snippet document from the snippets
index and from relevant project pages.

### 2.7 Earn clicks on the impressions you already have

This is now the cheapest win. GSC (90 days) shows `synforge` at position ~3.3
with 104 impressions and **0 clicks**, `/snippets` with 51 impressions and 0
clicks in 28 days, and `/certificates` with 33 impressions and 0 clicks. Rewrite
those titles/descriptions first and re-measure CTR after 2–4 weeks:

- `/` — name-first title: “*Name* — Full-Stack Developer | Syn-Forge”, with a
  description that states what was built and for whom.
- `/snippets` — “Code Snippets & Developer Notes | Syn-Forge”, naming the topics
  (database migrations, etc.).
- `/certificates` — “Certifications & Training — Full-Stack Developer”.
- Snippet documents — use the note headline, not the filename, and add the date.

**Status (deployed 2026-11-21):** titles are 52–59 emitted characters and
the five short descriptions sit at 121–132; `/` and `/ai` keep their existing descriptions. The head is
single-sourced: `GlobalHeadManager` defaults from `src/data/socialPreview.ts`, every page dropped its
literal props, and the description tag is updated rather than duplicated. Both gate stages passed on the
final diff; verified on the Pages runtime by `npm run verify:pages` (7 routes, one description after
hydration, `/ai` meta vs MCP lede, the 404 keeps its own head) and by 211 unit tests, and shipped in the
2026-11-21 release. Remaining from this section, and not implementation: the snippet-document headline
is still slug-derived, and the social cards were regenerated from the same map.

---

## Phase 3 — Content architecture (month 1–2)

This is the real ranking ceiling: 13 URLs, none targeting a specific query.

**Status 2026-11-25: item 3.1 is implemented, gated, and pushed to `main` (`50b6304d`, 38 one-path
commits); it is not deployed yet.** 3.2–3.6 are untouched.

### 3.1 Project detail pages (highest-value content addition)

The API already returns 7 projects with `long_description`, `categories`,
`stack`, `highlights`, `gallery`, `project_link`, `created_at`. Create
`/projects/:slug` pages (e.g. `/projects/bai-finance-website`) with:
- H1 = project title, summary, problem/outcome, stack, highlights, screenshots
  with descriptive alt text, repository/live links.
- `TechArticle` or `SoftwareSourceCode` + `BreadcrumbList` schema.
- An `ItemList` on `/projects` linking all seven.

This converts existing data into seven indexable pages that can rank for the
project names and technologies.

**Status — implemented, verified locally and merged; the Pages redeploy is pending.** Pushed to `main`
as `50b6304d` in 38 one-path commits after three increment gates plus a fresh whole-diff closeout
(`VERDICT: PASS` twice, no blockers). Two non-blocking residuals are recorded, not fixed: a total
failure of the archive walk now leaves the build's `/projects` fragment with no rows or count, and the
`TechArticle` video-cover guard has no test. Seven pages at
`/projects/:id/:slug`, not the literal `/projects/:slug`: there is no slug column, and a title-derived
slug would 404 an indexed URL on a rename, so the id is the identity and a stale slug redirects. Each
page carries a server-rendered head, a `TechArticle` + `BreadcrumbList` graph, a build-time body
fragment, a sitemap entry and an archive link; the archive's `ItemList` now publishes its seven
members. Limits recorded rather than claimed closed: no project fragments on a build with no API, a
fragment lags an edit until the next deploy, a 120-project walk ceiling, no `<lastmod>` on project
entries, and the snippet-document route's pre-existing any-slug duplicate. The `/projects/:slug`
follow-up needs a slug column plus slug history and a production migration; it is not started.
Design record: [[operations/seo-phase-3|SEO phase 3]]. Deployment is the remaining step: a Pages
redeploy from `main`, then a live check of one detail URL's head, the 308 matrix and the 15-`<loc>`
sitemap.

### 3.2 Certificate detail pages or richer listings

Create `/certificates/:id` (or expandable indexable sections) with issuer,
date, credential link, and skills. Add `ItemList` + `EducationalOccupationalCredential`
schema.

### 3.3 Add the missing page types

- `/about` — ProfilePage with bio, location/service area, credentials, contact,
  and `Person` as the canonical entity. Recruiters and service buyers search
  for this.
- `/services` — only if you want client work: what you build, stack, process,
  and a contact CTA.
- `/notes` — a real index for snippet documents, grouped by topic, with dates
  and an author byline. Gives the archive a crawlable hub.
- `/contact` or a clear contact CTA (the current site only exposes social
  links in the footer).

### 3.4 Thicken the home page

Rendered home is ~216–287 words, much of it UI chrome. Add a short
who/what/for-whom section, 2–3 outcome bullets, and links to the strongest
project and notes. Put the role/value in the H1 and move "Calm Interfaces,
Seamless Experiences —" to the kicker; the current heading is a slogan, and the
kicker is split into a sibling `<p>` so it reads as a dangling sentence.

### 3.5 Rewrite the migrations note for a featured snippet

The note is the one page type that already matches intent. Put a 40–60 word
direct answer ("A migration is a file that records a database change…") and a
4-step ordered list immediately under the H1, before the anecdotal opening. Add
FAQ-style sections as visible prose for People Also Ask — **not** `FAQPage`
markup (retired).

### 3.6 Entity and authority

- Pick one canonical name ("Operator-Syn" vs the personal name in the API) and
  make every other form an `alternateName`. The MCP, JSON-LD, meta, llms.txt,
  and GitHub currently disagree.
- Add the site URL to the GitHub profile `blog` field and write a bio so the
  `sameAs` is reciprocal.
- Add LinkedIn (and any other real profiles) to `sameAs`.
- Publish one or two technical write-ups and cross-post to an indexable
  platform; no third-party corroboration currently exists.

---

## Phase 4 — AI search and monitoring (ongoing)

- Publish a real `llms-full.txt` (concatenated snippet docs + project
  summaries) or omit it. Add the three snippet URLs, `/netbird`, `/atelier`,
  `/agent`, and `lastmod` dates to `llms.txt`.
- Add `/.well-known/ai-catalog.json` pointing at `https://mcp.syn-forge.com/mcp`
  (now blocked by the soft-404 fix).
- Add named AI-agent groups and content signals to `robots.txt` if you want to
  distinguish search inclusion from training.
- Add IndexNow key + deploy-time submission (`public/<key>.txt`).
- Set up Google Search Console (Domain property, DNS verification), submit the
  sitemap, and configure the Google API key for PSI/CrUX.
- Re-run this audit monthly; a drift baseline was captured on 2026-11-19.

---

## Expected outcomes

| Phase | Index quality | Raw-content visibility | Ranking surface |
|---|---|---|---|
| 1 | Real 404s, no duplicate canonicals | metadata only | unchanged |
| 2 | + unique per-page metadata | H1/body/nav in raw HTML | pages eligible for non-JS crawlers |
| 3 | + 7 project pages, about, notes | full content | new query targets |
| 4 | + entity corroboration | full content + llms-full | AI citations, faster indexing |

## What not to bother with

- `hreflang` / internationalization — the site is English-only.
- Backlink campaigns — domain-level links are a weak predictor at this size;
  entity corroboration and content matter more.
- A second marketing context file — this repo already centralizes product
  context in `PRODUCT.md`, `DESIGN.md`, and `.impeccable/config.json`.
