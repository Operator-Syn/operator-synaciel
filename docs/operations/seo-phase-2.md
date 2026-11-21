---
title: SEO Phase 2
tags:
  - operations
  - seo
role: record
---

# SEO Phase 2 — what shipped and why

The SEO audit's phase 2 covers rendering and on-page work. This note records what each item changed, the
decisions behind it, and what remains. Search-analytics figures and third-party authority data stay in the
local audit directory, which is git-ignored on purpose.

## Status

Everything in this phase is implemented, gated and **deployed to production on 2026-11-21** (Pages
`operator-synaciel`, main at `850424ba`). The one check still outstanding is visual: inspect the
fragment-to-route transition in a throttled browser and measure CLS.

Verified live after the release: all seven public routes return the `<main class="prerender-body">` fragment
with its own `h1`; `/prerender/projects.html` is `404`; `/fonts/ibm-plex-sans-var.woff2` is `200` (45 712
bytes); `/netbird` still carries `x-robots-tag: noindex, follow`; `/projects` shows `[ 8 projects ]` with a
five-link footer, six transformed project images and no leftover fragment after hydration; `/certificates`
shows `[ 9 certifications ]` with every certificate image on the `768×569,fit=pad,background=transparent`
canvas except the `placehold.co` placeholder card, which is correctly left alone.

| Item | State |
|---|---|
| 2.1 pre-render | done — visual/CLS check remains |
| 2.2 headings and alt text | done |
| 2.3 pagination, placeholder data, settings drawer | done |
| 2.4 image weight and layout stability | done — project media, portrait and certificates |
| 2.5 fonts and main thread | done |
| 2.6 internal linking | done |
| 2.7 titles and descriptions | done |

## What changed, by item

**2.7 / 2.2 metadata.** `src/data/socialPreview.ts` owns the title and description of each served route, and
`GlobalHeadManager` defaults from it and updates one description tag rather than appending a second. Three
places do not use the map: the `NotFound` route component and the snippet-document page's not-found state
supply their own copy, and `public/404.html` is served without the app at all. The route-metadata test owns
the length budgets for the seven indexable routes; the derived snippet-document titles are outside that
budget and outside this note's claims.

**2.2 headings.** `/snippets` renders a visible `h1` and an `h2`-headed document list. The home `h1` is the
role line `Software developer building calm, dependable web systems`, from `src/data/homeHeroCopy.ts`, and it
renders before the API resolves; the owner's tagline moved to the kicker, where both D1 phrase fields still
apply. `MediaRenderer` requires `alt` at all four call sites and the portrait's alt derives from the API's
`Name` entry.

**2.3 archives.** Both archives fetch twelve records per request, so the live projects and certificates
render on one page; cursor controls appear only when there is something to page (`shouldShowArchivePagination`).
The settings drawer mounts its body on first open, keeping roughly 160 words of theme labels out of every
page's crawlable DOM while still animating a real body on close.

**2.3 snippet data.** Production D1 held a template `README.md` and a third-party PDF inside a placeholder
folder. The two files and their two bucket objects were removed, then the folder, which had no object of its own;
`/snippets` now shows one folder with one document. The sitemap follows within a day because it caches the tree for 24 hours.

**2.4 images.** Certificates are *normalised* rather than merely resized: they arrive at ratios from 0.71
to 1.41, so a bare width left heights ranging 332–633 px. Each is padded to a 768×569 canvas with a
transparent fill, which keeps the whole certificate visible (the card shows it with `object-fit: contain`)
and lets the active theme's surface show through. Measured across the eight live certificates: 2 454 KB of
originals become 283 KB, heaviest card 76 KB instead of 716 KB.

Project media and the portrait load through the media zone's image service
(`/cdn-cgi/image/width=…,format=auto,quality=78/…`), at 1360 px and 360 px respectively, with `width`/`height`
for the display ratio, `loading` by position, and `fetchpriority="high"` on the portrait only. Measured by requesting the objects through the image service (the source and transformed sizes are
reproducible with a single `curl -I` against each URL, not asserted by a test): the project screenshot falls
from roughly 900 KB to roughly 33 KB, and the portrait from roughly 185 KB to roughly 21 KB. A
failed transform falls back to the original object once per URL, and that path is tested.

**2.5 fonts and timers.** Five WOFF2 files (148 120 bytes, licences included) are served from `/fonts/`,
excluded from the Pages Function and cached immutably; the Google Fonts stylesheet and its preconnects are
gone, replaced by two preloads. The home clock stops ticking while the tab is hidden.

**2.6 linking.** A site footer links five routes — Home, Projects, Certificates, Snippets and AI — on every
React route except `/`, which keeps its own footer as the single `contentinfo`; the snippet index links every
document leaf. The static 404 page (`public/404.html`) is served without the app and keeps its own recovery
links. `/privacy-policy`, `/terms-and-conditions`, `/netbird`, `/atelier` and `/agent` stay unlinked from the
footer, which is unchanged behaviour.

## 2.1 Pre-render implementation

**2.1 pre-render.** The seven public routes (`/`, `/projects`, `/certificates`, `/snippets`, `/ai`, `/privacy-policy`, `/terms-and-conditions`) use build-generated body fragments. `scripts/prerender.ts` empties `public/prerender/`, writes one fragment per route from the shared `src/data/prerenderRoutes.ts` route table, and verifies all seven files exist with their expected content before the build proceeds. The Pages middleware fetches the matching fragment through `ASSETS.fetch()` and injects it into `div#root` with `HTMLRewriter`; a missing fragment leaves the HTML response unchanged. React's `createRoot` discards that initial markup on mount, after which the lazy route renders normally.

The route data exports the headings and leads used by the corresponding page components; `PRERENDER_NAV_LINKS` supplies links to all seven routes. Home's heading and fallback lead are shared from `homeHeroCopy.ts`, while the AI lead composes `PORTFOLIO_MCP_DESCRIPTION` and a suffix. `formatArchiveCount(total, noun)` is shared by both archive pages and the generator. A double-increment defect—pages passed an already-incremented count—was found and fixed by making callers pass the unincremented total.

The headings, leads and navigation do not require network access. Optional API enrichment is bounded by a five-second timeout and cannot fail the build; when the API is unreachable the seven static fragments are still generated without counts or rows. `/prerender/*` was not added to `_routes.json`: direct requests return 404 through `isKnownRoute`, and `ASSETS.fetch` accesses the asset binding without re-entering the Function.

**Build verification:** 259 unit tests and 30 Pages tests passed; typecheck, Biome, ESLint, `docs:check` and build passed. With `VITE_API_URL=http://127.0.0.1:1`, all seven fragments were still written and the prerender Pages spec passed 7/7 (the header-count test is stub-backed, so it is network-independent).

## Decisions worth keeping

- **Archive media boxes are container-sized, not viewport-sized.** A viewport `sizes` value cannot describe
  them, which is why the image work uses one fixed-width transform instead of `srcSet`/`sizes`.
- **Photo media is sized for the widest box at DPR2**, 1360 px, rather than per breakpoint. The alternative
  was several kilobytes of choice between AVIF candidates against a ~900 KB baseline — not worth the fragility.
- **Certificate media is normalised by padding, not cropped.** It changes ratio between states, so a bare
  width fitted it badly; padding to one canvas keeps every certificate whole and makes the byte cost
  predictable. Cropping was measured too and was both heavier and destructive.
- **`/cf-fonts` stays excluded** from the Pages Function even though Google Fonts is gone; the exclusion is
  accurate if Cloudflare Fonts is ever re-enabled.

## Remaining

**2.1 visual/CLS check:** inspect the fragment → Suspense skeleton → route sequence in a throttled browser and measure cumulative layout shift. This has not been done; the two transitions and CLS remain unmeasured.