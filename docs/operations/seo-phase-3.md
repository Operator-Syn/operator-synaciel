---
title: SEO Phase 3
tags:
  - operations
  - seo
role: record
---

# SEO Phase 3 — project detail pages (item 3.1)

Item 3.1 is the highest-value content addition in the audit: it turns seven rows in the project
archive into seven indexable pages. This note records what shipped, what the audit asked for that the
repository could not support, the decisions behind the difference, and the limits that remain.

**Status: implemented and verified locally on `main`; not committed, pushed or deployed.** The audit's
state for every item stays in [[operations/seo-action-plan|SEO action plan]].

## What shipped

`/projects/<id>/<slug>` — seven pages, one per project, with a server-rendered head, a
`TechArticle` + `BreadcrumbList` graph, a build-time body fragment, a place in the sitemap, links from
the archive, and a client-rendered page.

| 3.1 asked for | What shipped | Why |
|---|---|---|
| `/projects/:slug` (e.g. `/projects/bai-finance-website`) | `/projects/:id/:slug`, with a 308 from a bare id, a stale slug, a zero-padded id or an encoded spelling | `Projects` has no slug column. A title-derived slug has no stable identity, so a title edit would 404 an indexed URL; with the id as identity, a stale slug redirects instead. A stored slug plus slug history is the follow-up that removes the id |
| H1 = title, summary | Rendered by the page **and** carried in the fragment | The fragment is discarded by `createRoot`, so the page's own heading is what users and accessibility tooling get |
| "problem / outcome" | The stored prose, rendered as paragraphs and bullets | There are no problem/outcome columns; `long_description` is one text blob. Splitting it is authoring, not code |
| stack, highlights | Two facet lists, page and fragment | Both arrays are populated on all seven records |
| screenshots with descriptive alt text | Cover image plus the gallery, with `"<title> cover image"` / `"<title> gallery image N"` | The API has no alt field, so alt names the project rather than describing pixels nobody recorded. Three of seven records have no gallery and four have one item |
| repository / live links | The single `project_link`, rendered only when it parses as absolute http(s) | One field, GitHub for four records and a live site for three. `safeExternalHref` drops `javascript:`, `data:` and relative values |
| `TechArticle` **or** `SoftwareSourceCode` + `BreadcrumbList` | `TechArticle` + `BreadcrumbList` | These are written case studies, and three of seven pages do not link to code at all |
| an `ItemList` on `/projects` linking all seven | `itemListElement` + `numberOfItems` in the server graph, and a real `<a>` per archive row | The graph members are published only when the collection was read completely |

## Decisions worth keeping

- **Head ownership on a project path: two managers, one writer.** `src/main.tsx` renders a head manager
  for every route, and the page renders its own. The root one now stands aside when it has no title and
  the path is a project detail path — the map has only the archive's entry, so writing it would replace
  the server's per-project head during loading, and permanently if the fetch failed. The page supplies
  the per-project head only once the project has resolved. **The plan missed this**: D6 analysed the
  page's manager and not the app-root one, and the increment-2 "fix" was half a fix until the Pages
  spec's aborted-fetch test caught the archive title on a project URL.
- **The lookup treats "absent" as a claim that needs proof.** A project is `missing` only when a fresh
  read reached `has_more === false` with a stable `total` and the walk saw exactly that many distinct
  ids; anything else is `unknown`, and an unconfirmed project page is served `200` with
  `X-Robots-Tag: noindex, follow` rather than 404'd. Both the id-spelling and the percent-encoding form
  of a canonical URL 308 to the one canonical string.
- **The existence read bypasses the edge cache; the archive and sitemap reads use it.** A list cached
  for an hour can be missing a project created five minutes ago, and deciding absence from it would
  404 a live page. `fetchContentText` defaults its `cache` parameter, so the bypass is an explicit
  no-op `ContentCache`, not `undefined`.
- **Canonicality is decided on the raw URL.** `ParsedProjectPath` keeps `idText` and `slugText` as
  written; comparing decoded values let `/projects/08/…` and `/projects/8/%62ai-…` each serve a second
  indexable copy.
- **`canonicalRedirect` no longer lowercases percent-escape hex.** The runtime re-spells escapes as
  uppercase (`%2d` arrives as `%2D`); lowercasing the whole path made every such request look
  non-canonical and redirect forever. This fixed a loop that already existed for snippet documents
  whose names need encoding. A path that combines a case fold with an encoded slug can still take two
  hops (the helper cannot derive the project title); it terminates at the canonical URL, and every
  single-issue variant is one hop.
- **Project sitemap entries carry no `<lastmod>`.** The table has no `updated_at`; a creation date
  would tell crawlers that an edited page never changes.
- **A project-archive failure fails the sitemap closed** (last-known-good, else 503) instead of
  publishing a sitemap that silently omits seven URLs.

## Limits, recorded rather than claimed closed

- **No API at build time means no project fragments.** The build exits 0 and writes the seven static
  fragments; those project pages then serve head metadata only. Verified with
  `VITE_API_URL=http://127.0.0.1:1`.
- **A fragment lags an edit until the next deploy.** The head and the client page reflect a changed
  title or description immediately; the injected body does not.
- **One walk ceiling, and a wider blast radius than "detail pages go `noindex`".** Past 120 projects
  (ten pages of twelve) every lookup answers `unknown`, so detail pages serve `noindex` until the
  ceiling is raised. The same bounded walk backs the sitemap and the archive `ItemList`, so the same
  growth — and today, a single malformed project row, a short page, or a changing `total` — makes the
  **whole** sitemap fall to its last-known-good copy or a 503, and omits the `ItemList` members. That is
  the contract (fail closed rather than publish an incomplete sitemap), but it means a project-data
  problem can take the snippet and static URLs out of a fresh sitemap too. Seven records today.
- **The completeness proof assumes an accurate, stable `total`.** Rows and `COUNT(*)` come from one
  `Promise.all`, not one snapshot, and a stable undercounted `total` plus a concurrent delete can still
  hide a live entry. The proof closes the reorder case and the changing-`total` case; closing the rest
  needs a single-snapshot count in the API.
- **An old last-known-good sitemap has no project entries.** One success cycle after an archive
  failure can serve a 200 without them; the next successful request refreshes it.
- **`parseProjectDescription` handles the stored shape** — blank-line paragraphs and one-line `-`/`•`
  bullets. Nested or wrapped bullets would be flattened.
- **The snippet-document route still accepts any slug** (`/snippets/document/22/anything` serves the
  document). That is a pre-existing canonicalisation gap on a different route, not closed here.
- **Local Pages runs used a substituted browser.** The pinned Playwright build wants
  `chromium_headless_shell-1234`; this host has 1248/1254, so the suite ran through the repository's
  documented `PLAYWRIGHT_CHROMIUM_EXECUTABLE` escape hatch. Restoring the pinned engine for CI is
  still outstanding.

## Deferred: `/projects/:slug` without the id

A stored `slug` column plus a slug-history table would let the canonical URL drop the id and 301 an
old slug instead of 404ing it. That is a production migration and a data backfill on rows the site
already indexes, so it is a separate, separately authorised piece of work. The current shape is
correct without it: one canonical URL per project, and every other spelling redirects.

Still open from Phase 3: certificate detail pages (3.2), `/about`, `/services`, `/notes` and contact
(3.3), home thickening (3.4), the migrations-note rewrite (3.5) and entity work (3.6).

## Verification

Run locally on the final tree:

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run test --workspace=@syn-forge/portfolio-web` | 328 pass, 0 fail |
| `npm run lint` | exit 0 |
| `npx biome check .` | clean |
| `npm run build` | 7 static + 7 project fragments |
| `VITE_API_URL=http://127.0.0.1:1 npm run build` | exit 0, 7 static, 0 project fragments |
| `npm run verify:pages` (Chrome substitution noted above) | 44 pass |
| `npm run docs:check` | valid |

Runtime, `wrangler pages dev dist` against the live API:

```
/projects/8/bai-finance-website   200  one h1, summary, Stack, Highlights, description, nav
/projects/8                       308  -> /projects/8/bai-finance-website
/projects/08/bai-finance-website  308  -> the canonical form
/projects/8/%62ai-finance-website 308  -> the canonical form
/projects/999999/nope             404  X-Robots-Tag: noindex
/projects                         200  seven row links, ItemList of seven
/sitemap.xml                      200  15 <loc>, 8 <lastmod>, no project lastmod
/prerender/project-8.html         404  fragments stay unreachable
```

With the API unreachable, a project path answers `200` with `X-Robots-Tag: noindex, follow` and the
archive's head copy: the page is served, never published as an indexable page whose existence the
server could not confirm.

That last state is verified by a manual runtime probe and by a source guard, not by an automated
behavioural test: the Pages suite binds one API URL, so exercising the unreachable-API branch would
need a second server. The client half — the bare-id route replacing itself with the canonical URL —
is asserted in the Pages spec.
