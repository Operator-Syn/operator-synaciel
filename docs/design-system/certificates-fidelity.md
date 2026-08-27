---
title: Certificates Fidelity
aliases:
  - Certificates archive
  - Credential archive reference
tags:
  - design-system
  - certificates
  - responsive
  - visual-qa
role: contract
---

# Certificates Fidelity

The certificate reference is stored at
[`references/portfolio-certificates.png`](references/portfolio-certificates.png).
It is a composition reference, not an API fixture. The route keeps the
existing certificate content and legacy API boundary while adding the
versioned archive read path.

## Composition contract

At the reference desktop size (`1586x992`), the page presents these bands in
order:

1. Shared navigation and the pointer coordinate rail.
2. `03 / 04` archive heading, explanatory copy, and the total credential count.
3. Six indexed certificate records in a two-column, three-row archive.
4. The range label and cursor previous/current/next controls.

Each record is an editorial unit with an index, contained certificate media,
credential type, title, short description, and a credential link. The media
button opens the existing `MediaModal`; the credential link opens the existing
external certificate URL. The two actions remain distinct so viewing a
certificate preview does not unexpectedly leave the portfolio.

## Data boundary

The route uses the additive versioned archive read endpoint:

- `/api/v2/certificates/archive`

The v2 response uses the shared cursor contract: `limit`, opaque `cursor`,
`data`, and `pagination` with `total`, `has_more`, and `next_cursor`. Each page
includes its certificate `items` in the response. The existing unversioned
`/api/certificates`, `/api/certificates/:id`, and
`/api/certificates/:certId/items` endpoints remain unchanged for older portfolio
clients. The display-only in-progress card remains outside the API total and
cursor; it is appended only on the final page.

## Interaction contract

- `PointerCoordinates` is reused as the single coordinate/status rail. The
  certificate route marks the center position with the shared three-mark
  orientation instrument.
- Fine pointers use the existing cursor state hooks: `zoom-in` over certificate
  preview media, `cell` over the copy region, and `alias` over external
  credential links. Touch and reduced-motion users retain browser-native
  pointer behavior and immediate state changes.
- Hover and `:focus-within` raise the entire certificate record, tint its index
  and title amber, and keep the media scale change bounded. The feedback layer
  covers the full record boundary and never becomes a smaller nested card.
- Pagination uses the shared cursor controls with previous/current/next actions;
  page changes respect reduced motion when returning to the archive heading and
  use cursor history for backward navigation.
- Loading, error, empty, keyboard-focus, modal, and unavailable-link states are
  represented without relying on hover or color alone.
- The shared MediaModal presents image media fit-to-frame first, then exposes bounded
  zoom, focal-point wheel zoom, drag/pinch inspection, reset, and keyboard controls
  without changing the certificate route's data contract.

## Responsive contract

The archive uses a container query because the page frame—not the browser
viewport alone—determines whether two credential records can keep a readable
measure.

| Frame width | Behavior |
| --- | --- |
| `>= 1240px` | Two archive columns; each record keeps index, media, and copy columns. |
| `761px-1239px` | One archive column; records retain a compact index/media/copy row. |
| `<= 760px` | One column; each record reorders into index, media, copy, and credential action. |
| `<= 640px` | Compact route heading and pagination spacing; fixed navigation receives extra bottom clearance. |

The mobile composition removes the desktop vertical editorial separators from
inside a record, keeps media contained rather than cropped, preserves a
minimum-size action target, and leaves the fixed Quick Navigation control clear
of the final pagination band.

## Implementation map

- [`src/components/pages/certificatesPage/Certificates.tsx`](../../src/components/pages/certificatesPage/Certificates.tsx)
  owns public queries, paging, modal state, and route landmarks.
- [`src/components/pages/certificatesPage/CertificateArchive.tsx`](../../src/components/pages/certificatesPage/CertificateArchive.tsx)
  owns the repeated credential record and its media/link semantics.
- [`src/components/pagination/CursorPaginationControls.tsx`](../../src/components/pagination/CursorPaginationControls.tsx)
  renders the certificate cursor range controls.
- [`src/styles/certificate-archive.css`](../../src/styles/certificate-archive.css)
  owns the archive grid, full-record feedback, cursor controls, and
  container-query collapse.
- [`src/controller/CertificatesPageController.ts`](../../src/controller/CertificatesPageController.ts)
  validates the versioned archive query contract.
- [`src/model/CertificatesPageModel.ts`](../../src/model/CertificatesPageModel.ts)
  owns certificate keyset ordering, cursor encoding, totals, and batched items.
- [[design-system/interaction-patterns|Route interaction patterns]] owns the
  shared coordinate rail, modal, cursor, and fixed-navigation rules.

## Verification targets

Check the loaded route at `1586x992`, `1200x900`, `900x900`, `768x900`,
`640x900`, and `390x844`. Confirm no horizontal overflow, readable long titles,
contained media, reachable credential links, cursor previous/next controls, modal Escape
and focus restoration, touch-safe controls, and reduced-motion feedback. Also
check loading, error, empty, and the in-progress archive entry while preserving
the legacy API routes and stored certificate content.
