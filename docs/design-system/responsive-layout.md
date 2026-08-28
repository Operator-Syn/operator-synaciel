---
title: Homepage Responsive Layout
aliases:
  - Responsive layout audit
  - Homepage breakpoint plan
tags:
  - design-system
  - homepage
  - responsive
  - visual-qa
role: audit
---

# Homepage Responsive Layout

This note records the responsive reference, the breakpoint failure found with
browser inspection, the scoped CSS addressing rule, and the plan for keeping
the composition stable as real content changes.

## References

- [`references/portfolio-home.png`](references/portfolio-home.png) is the
  desktop composition reference (`1586x992`).
- [`references/portfolio-home-responsive-failure.png`](references/portfolio-home-responsive-failure.png)
  is the task screenshot showing the intermediate-width failure.
- [`references/portfolio-home-responsive-work-failure.png`](references/portfolio-home-responsive-work-failure.png)
  is the follow-up narrow-width screenshot showing selected-work cards
  collapsing into word-by-word columns.
- [`references/portfolio-home-responsive-wide-reference.png`](references/portfolio-home-responsive-wide-reference.png)
  is the follow-up wider-width screenshot used to confirm the three-card
  composition remains the right desktop direction.
- [`references/portfolio-home-responsive-fixed.png`](references/portfolio-home-responsive-fixed.png)
  is the corrected full-page tablet reference captured at `900x900`.
- [[design-system/homepage-fidelity|Homepage fidelity]] remains the authority
  for content ownership, route behavior, and the desktop visual grammar.

The images are visual evidence, not API fixtures. They must not turn layout
labels, coordinates, indexes, or generated project ordering into database
fields.

## Issue

Before the fix, the homepage had a mobile breakpoint at `640px`, but the
desktop two-column hero remained active above it. This made the layout appear
valid by width while becoming unreadable by content density:

| Browser viewport | Hero side width | Identity details width | Observed result |
| --- | ---: | ---: | --- |
| `900px` | `324px` | `72px` | Profile values wrapped into narrow vertical fragments. |
| `1075px` | `389px` | `137px` | The reported screenshot reproduced the same failure. |

The page did not have horizontal overflow. The failure was the narrower and
more important kind: the profile facts and tools were technically inside the
viewport but no longer had a readable measure. A full-page intermediate-width
check also found that the desktop footer grid gave its clock/message column
too little room before the hero needed to stack; around `1377px`, the column
was only about `179px` wide and wrapped the footer into a tall, fragmented
strip.
At `700px`, the selected-work grid added a second failure: three cards were
each about `199px` wide, leaving roughly `100px` for the title and description
column and causing word-by-word wrapping.

## Addressing

The responsive rule lives in
[`apps/portfolio-web/src/styles/app.css`](../../apps/portfolio-web/src/styles/app.css), in the homepage responsive
media blocks:

- At `1100px` and below, `.homepage-hero-grid` changes from two columns to a
  block flow.
- The hero copy moves its divider from the right edge to the bottom edge,
  preserving the reference's rule-based structure while allowing the identity
  rail to use the full shell width.
- Latest adjustment (2026-08-23): reduced `.homepage-hero-body` from
  `max-width: min(48rem, 100%)` back to `max-width: min(42rem, 100%)` after
  review. To restore the wider version, use `max-width: min(48rem, 100%)` in
  `apps/portfolio-web/src/styles/app.css`.
- At `1480px` and below, the footer changes to an index-and-content grid. The
  clock becomes a block, and social links receive a full-width row below it;
  this footer transition happens before the hero transition because the footer
  has the denser content-fit constraint.
- At `900px` and below, selected-work cards become a single readable column;
  the existing `640px` mobile rules continue to control compact card spacing.
- The existing `640px` rules still control compact gutters, display type,
  identity sizing, and mobile footer spacing.
- Above `900px`, the selected-work strip returns to three columns. Above
  `1100px`, the reference two-column hero returns; above `1480px`, the
  three-column footer returns when its content still fits comfortably.

This is presentation-only. It does not change React data queries, public API
routes, D1 schema, R2 media behavior, project ordering, or content.

## Responsive Contract

| Width band | Required behavior |
| --- | --- |
| `<= 640px` | Mobile stack; compact gutters; stacked work records and footer. |
| `641px-900px` | Full-width hero flow; one-column selected work; readable identity, tools, and footer rows. |
| `901px-1100px` | Full-width hero flow; three-card selected work; footer message and socials get separate rows. |
| `1101px-1480px` | Preserve the two-column hero and three-card work strip; footer message and socials get separate rows. |
| `> 1480px` | Preserve the reference two-column hero and three-column footer where content remains readable. |

Every band must preserve these invariants:

- No horizontal overflow caused by the homepage shell or its children.
- Profile labels and values remain readable; values must not collapse into
  one-word-per-line fragments.
- Tool rows may wrap their values, but the category column must remain distinct
  from the value column.
- Actions, project links, navigation, and social links remain reachable by
  keyboard and usable without hover.
- Loading, empty, and partial-error states must follow the same layout rules as
  loaded content.
- The visual order remains identity, tools, selected work, then footer.

## Verification Matrix

The corrected page was checked with Chrome DevTools against the neighborhoods
around both breakpoints:

| Viewport | Result |
| --- | --- |
| `375x844` | Mobile stack; no horizontal overflow. |
| `640x900` | Mobile rules; no horizontal overflow. |
| `700x900` | Tablet hero flow and one-column work; no horizontal overflow. |
| `768x900` | Tablet hero flow and one-column work; no horizontal overflow. |
| `900x900` | Reported failure fixed; one-column work, readable footer, no horizontal overflow. |
| `960x900` | Three-card work strip retained; no horizontal overflow. |
| `1024x900` | Three-card work strip and tablet hero flow; no horizontal overflow. |
| `1075x998` | Reported failure band fixed; three-card work strip and no horizontal overflow. |
| `1377x900` | Footer content-fit transition active; no fragmented clock/message wrapping. |
| `1150x900` | Desktop two-column hero retained; footer uses its separate content row. |
| `1200x900` | Desktop two-column hero retained; footer uses its separate content row. |
| `1440x900` | Two-column hero retained; footer uses its separate content row. |
| `1600x1000` | Reference composition fits the viewport. |

The browser pass reported no console errors or warnings. The repository app
verification also passed typecheck, lint, and production build.

## Future Plan

1. Keep the footer-specific `1480px` boundary alongside the `1100px`, `900px`,
   and `640px` behavior boundaries; these are content-fit decisions, not
   typography targets.
2. When content density changes, test both sides of each boundary and inspect
   bounding boxes for the identity details, tools values, project cards, and
   footer message.
3. Add a small automated viewport smoke check for `scrollWidth` and critical
   region widths if responsive regressions recur.
4. Re-check loaded, loading, empty, and partial-error states because missing or
   unusually long data can expose a breakpoint failure that the current seed
   data does not show.
5. Update the checked-in responsive references when the composition contract
   intentionally changes; do not overwrite them to hide a regression.
