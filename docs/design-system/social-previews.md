---
title: Social Preview Cards
aliases:
  - Social previews
  - Open Graph cards
tags:
  - design-system
  - social-preview
  - visual-qa
role: contract
---

# Social Preview Cards

Social preview cards are the server-generated first impression for links shared
from Syn-Forge. This note defines the composition contract for the Cloudflare
Pages image response and keeps that presentation separate from the public page
layout.

## Scope and invariants

- `functions/_middleware.ts` renders one `1200x630` PNG with
  `ImageResponse`.
- `src/data/socialPreview.ts` remains the single source for route metadata,
  route fallback, and image URLs.
- `GlobalHeadManager` and the Pages HTML rewriter continue to use those same
  route-aware image URLs and existing Open Graph/Twitter metadata.
- Route copy remains the existing title and description. Do not add claims,
  metrics, testimonials, or new persisted fields for a visual treatment.
- The endpoint remains static and cacheable. No new package, bitmap asset, API
  route, D1/R2 contract, or page-layout change is part of this pass.

## Visual contract

The card should feel like a compact edition of the **Working Archive**:
editorial hierarchy first, technical notation second, and one warm signal.

| Level | Role | Treatment |
| --- | --- | --- |
| Signal | Route title and author identity | Large cream Newsreader title, stable measure, and a legible JSB mark. |
| Structure | Wordmark, route context, description, and URL | IBM Plex Sans/Mono, visible rules, route index, and a two-zone frame. |
| Atmosphere | Grid registration and depth | Near-black canvas, flat surface contrast, faint rules, and one amber registration mark. |

### Composition

- Keep the `1200x630` aspect ratio and reserve a generous inset so the title
  survives thumbnail cropping and link-unfurl padding.
- Use a ruled outer frame with a compact utility header, a dominant left content
  field, a distinct right identity field, and a low-contrast footer band.
- Show the route as both a readable label and an ordered `01 / 08` index. The
  index is derived from `SOCIAL_PREVIEW_ROUTES` and is presentational only.
- Treat the JSB identity mark as the single graphic motif: a square-edged
  identity panel with a small amber registration point and aligned rules. It
  should read as authored identity, not fake telemetry.
- Keep route titles and descriptions as real text. Long route titles may wrap,
  but the title remains the first meaningful visual read; the description stays
  subordinate and bounded.
- Reserve amber for the route signal, the identity registration point, and the
  archive call to action. Do not add gradients, glass, large rounded cards,
  photographs, or decorative noise.

### Type and palette

- Use Newsreader with a Georgia serif fallback for authored titles and the JSB
  identity mark.
- Use IBM Plex Sans with an Arial fallback for the description and utility
  copy.
- Use IBM Plex Mono with a ui-monospace fallback for route indexes, path labels,
  and the footer.
- Keep the existing semantic palette: `#101111` canvas, `#171918` surface,
  `#f2ede3` text, `#b7b1a7` muted text, `#7e7b74` faint text, and `#f0a42a`
  signal.
- Prefer rules and tonal separation over shadows. The image should remain
  recognizable when the amber motif is removed.

## Route and state inventory

| Case | Expected behavior |
| --- | --- |
| Home | `/social-image.png`, `01 / 08`, portfolio title and current home description. |
| Public archive routes | Route-specific image URL, ordered index, title, and description. |
| Descendant path | Inherits its top-level route's card metadata and image path. |
| Unknown path | Uses the existing home fallback without changing the URL contract. |
| Long title | Wraps within the left content measure without clipping the identity or footer. |
| Metadata/head | Existing URL, dimensions, content type, and alt text remain unchanged. |

The card is a static image. There are no new hover, focus, keyboard, touch, or
reduced-motion states to implement; accessibility remains in the surrounding
HTML metadata and link destination.

## Implementation map

- `src/data/socialPreview.ts` owns the route order and metadata contract.
- `functions/_middleware.ts` owns only the card composition and image response.
- `tests/social-preview.test.ts` protects route mapping, metadata grounding,
  Pages-boundary generation, and crawler rewriting.
- This note is the durable visual handoff for the implementation; the supplied
  current-state screenshot is evidence, not a runtime asset.

## Verification target

Render the home, projects, certificates, and snippets cards at their native
`1200x630` output size and inspect them at thumbnail scale. Confirm the unknown
path fallback and a long-title case. Run:

- `npm run test:social-preview`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run docs:check`

Record any unavailable local Pages/browser check rather than treating source
inspection as visual proof.
