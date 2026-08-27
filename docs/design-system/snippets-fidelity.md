---
title: Snippets fidelity
aliases:
  - Snippets archive
  - File index workspace
tags:
  - design-system
  - snippets
  - responsive
  - interaction
  - content-preview
role: contract
---

# Snippets Fidelity

![Snippets archive reference](references/portfolio-snippets.png)

The Snippets route is a technical file-index workspace. It keeps the checked-in
two-pane composition while separating a bounded archive preview from a canonical
full-document view.

## Composition contract

The route is organized in this order:

1. shared navigation;
2. the shared pointer coordinate rail;
3. a ruled workspace with a left file index and a right persistent Preview
   pane;
4. the existing floating quick-navigation control.

The index pane exposes breadcrumbs, an `Index of /snippets/` heading, the current
path, a short instruction, and NAME/MODIFIED/SIZE metadata. Folders and files
are full-width records with visible selected and keyboard-focus states. The
preview pane keeps its header, format badge, full path, Download, and Close
actions visible while the selected content changes below it.

The route deliberately uses a persistent preview instead of opening another
modal. This keeps the file inventory and the inspected content visible at the
same time, and it gives Markdown, PDF, empty, loading, and error states a stable
surface.

## Preview and document contract

- The archive requests the existing tree from `GET /api/snippets`.
- Selecting a file requests only bounded preview metadata from
  `GET /api/v2/snippets/:id/preview`; the archive does not render the complete
  Markdown document.
- Markdown excerpts are computed server-side from a bounded R2 prefix. The
  archive's default 960-character budget is intentionally teaser-sized rather
  than a near-complete reading view. The boundary prefers a paragraph, then a
  line, then a hard character limit, and closes an open fenced code block before
  adding the truncation marker.
- The preview body has a bounded height and its own vertical scroll container.
  The workspace itself remains stable while a long excerpt is inspected.
- A truncated preview exposes a Read more action. It links to the canonical
  `/snippets/document/<id>/<slug>/` route rather than expanding the archive
  in place.
- The dedicated document route requests metadata from
  `GET /api/v2/snippets/:id` and full inline content from
  `GET /api/v2/snippets/:id/content`. Markdown, PDF, loading, not-found, and
  error states remain addressable at that URL.
- The dedicated Markdown reading surface keeps a controlled `72ch` measure while
  its desktop “On this page” rail is sticky and non-flowing: it begins beside the
  article, then pins near the top during deep reading. Heading IDs are derived
  from rendered heading text so links remain aligned with their sections; narrow
  screens expose the same rail as a floating Contents disclosure.
- The old unversioned snippet routes remain available for the existing portfolio
  and download behavior. The new v2 read routes are additive; they do not
  rename or reinterpret the old response contracts.

The canonical slug is derived from the current file name for sharing and
indexing, while the numeric snippet ID remains the stable lookup key. A stale
slug is normalized to the current canonical URL. The server derives parent
path segments at read time, so the route does not persist a duplicate path.

## Responsive contract

The workspace uses its own content breakpoints:

- above `960px`, the index and Preview panes share one ruled row;
- below `960px`, the panes stack while preserving the same reading order;
- below `640px`, the index title and path become a deliberate stacked lockup,
  file metadata moves below the name, and preview actions stack;
- the preview body remains internally scrollable at every breakpoint;
- the shell reserves bottom breathing room for the floating quick-navigation
  control and keeps the document free of horizontal overflow.

The shared coordinate rail continues to report the current pointer or touch
state. Its text is intentionally the shared `X/Y PX` status rather than a
second route-specific coordinate format. Browser-owned PDF viewers are isolated
surfaces; while hovered, the rail hands off to `PDF VIEWER` and suppresses
stale coordinates, then restores page tracking when the pointer leaves.

## Data, indexing, and migration boundary

The existing `SnippetsPageModel` remains the source for tree and R2 content
lookups. Preview excerpts, display paths, canonical slugs, and truncation state
are runtime-derived. No D1 schema migration is required for this first
implementation because `Snippets` already stores the stable ID, name, parent,
file format, size, and R2 storage path.

The build-time sitemap expands the static route list with document URLs when
the configured public API is available. `public/robots.txt` points crawlers
at the generated sitemap. The document route emits canonical metadata and
Article/TechArticle JSON-LD for direct indexing and sharing.

If a future requirement makes the slug independent of a mutable file name, add
a staged nullable slug column and a uniqueness rule after backfilling existing
rows. That is intentionally outside this preview change.

See [[design-system/references|Visual references]], [[api/routes|API routes]],
[[architecture/models|Models]], [[database/schema|Database schema]], and
[[design-system/interaction-patterns|Route interaction patterns]] for the
shared evidence and adoption rules.

## Verification targets

Verify the route at desktop and narrow/touch widths:

- no horizontal overflow;
- visible main, index, and Preview landmarks;
- folder and file rows reachable by keyboard;
- canonical and legacy route forms;
- empty, loading, error, Markdown, and PDF preview states;
- bounded preview height with internal scrolling;
- Read more navigation and stale-slug normalization;
- Download, Copy, Close, Escape, and reduced-motion behavior;
- document title, canonical URL, robots metadata, and JSON-LD.

The source checks are `npm run typecheck`, `npm run lint`,
`npm run format:biome:check`, `npm run check:biome:github`, and
`npm run build`. Keep the GitHub-reporter run clean; it is the repository's
formatter/lint gate. Documentation is checked with `npm run docs:check`; the
excerpt rule has focused coverage in
[`tests/snippet-preview.test.ts`](../../tests/snippet-preview.test.ts).
