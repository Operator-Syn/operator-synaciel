---
title: Homepage Fidelity
tags:
  - design-system
  - homepage
  - visual-qa
role: contract
---

# Homepage Fidelity

The homepage reference is stored at
[`references/portfolio-home.png`](references/portfolio-home.png). It is a
composition reference, not an API fixture. The implementation must preserve
the reference's dark editorial grammar while using current portfolio content.

## Composition contract

At the reference desktop size (`1586x992`), the page presents these bands in
order:

1. Navigation and coordinate metadata bar.
2. `01 / 04` identity hero with the display title, welcome kicker, profile
   note, actions, portrait, profile facts, and tools table.
3. `02 / 04` selected-work strip with three real project records.
4. `04 / 04` clock, message, and social-link footer.

The desktop composition should fit inside a `1600x1000` viewport without a
large trailing blank region. Mobile deliberately stacks the hero rail, tools,
work records, and footer while preserving the same order and rules.

The intermediate-width contract and its failure evidence are documented in
[[design-system/responsive-layout|Homepage responsive layout]]. The hero must
leave the two-column reference composition before the identity and tools rails
become too narrow; the footer must make the same transition rather than
forcing its message into a narrow column.

## Data boundary

The homepage consumes the existing public endpoints:

- `/api/settings`
- `/api/profile`
- `/api/sections` and `/api/sections/:sectionId/items`
- `/api/projects`

No D1 schema migration is required for this visual migration. Existing
`section_items.label` values are used for tool names; badge URLs provide a
display-only fallback when labels are absent. Projects use the existing
`display_order` and descriptions. Generated reference labels, coordinates,
technology tags, and project ordering are not persisted as new database
fields.

The homepage keeps rendering its static identity and available regions when an
individual public query fails. `localhost:5173` and `127.0.0.1:5173` are both
accepted local origins by the Worker CORS allowlist.

## Implementation map

- [`src/components/pages/homePage/Home.tsx`](../../src/components/pages/homePage/Home.tsx)
  owns the public queries and view-model adaptation.
- `src/components/homePage/` owns the coordinate bar, identity rail, tools
  table, selected work, and footer regions.
- [`src/styles/app.css`](../../src/styles/app.css) owns the homepage grid,
  rules, responsive breakpoints, and shared visual tokens. The tablet
  breakpoint is documented in [[design-system/responsive-layout|the responsive
  layout note]].
- [`src/components/quickNavigation/QuickNavigation.tsx`](../../src/components/quickNavigation/QuickNavigation.tsx)
  remains available on archive routes but does not cover the homepage.
- [`src/components/homePage/HomeSettings.tsx`](../../src/components/homePage/HomeSettings.tsx) and
  `src/components/sitePreferences/` own the fixed, browser-local visitor
  preferences utility; it is rendered outside the homepage flow.

## Motion and interaction contract

The homepage's motion thesis is a calm operator system coming online once. Motion
establishes hierarchy, reports real pointer state, and acknowledges
project-link focus without changing the composition or delaying content. The
resting markup is visible before JavaScript adds the
`homepage-motion-ready` enhancement class.

| Pattern | Owner | Trigger | Treatment | Reduced-motion behavior |
| --- | --- | --- | --- | --- |
| Entry choreography | `Home` + `app.css` | Initial mount | Coordinate bar, hero evidence, selected work, and footer arrive in a short stagger; the title uses a restrained rise/fade without occluding glyphs. | Content stays visible and arrives instantly. |
| Route rail order | `HomeCoordinates` + archive routes | Route mount | Home uses the first marker, Projects the second, and Certificates the third; the rail is a route index rather than a scroll progress indicator. | The active route marker remains visible immediately. |
| Work feedback | `HomeSelectedWork` + `app.css` | Mouse hover or keyboard focus | The existing card surface, number, title, and external-link arrow shift/color without changing size or order. | Focus and color feedback remain; spatial movement is removed. |
| Pointer signal | `HomeCoordinates` | Mouse or pen movement | Existing viewport coordinates remain the source of truth; the signal mark converts the pointer's viewport `x` into the coordinate rail's local position per animation frame, keeping it aligned with the actual cursor without positional easing. | The coordinate text remains available without the decorative mark. |
| Operator cursor | `app.css` + `public/cursors/` | Fine-pointer movement over the site shell | The cursor pack uses a brutalist vector grammar and the shared dark/cream/amber palette: native-feeling silhouettes carry the state first, with hard mitered geometry. Idle states stay cream/ink; amber is reserved for meaningful state signals—the under-finger activation line, the grip engagement point, denial marks, zoom signs, and geometric registration points. It includes the arrow, pointing hand, open grab hand, closed grabbing fist, and utility states. `AsyncImage` keeps ordinary portfolio images non-draggable and opts into the complete grab/grabbing surface only when `draggable` is explicitly requested. No DOM overlay, trail, or cursor-follow animation is used. | Custom cursor is absent; browser defaults and coordinate text remain. |
| Touch contact | `HomeCoordinates` | Touch start/move/end | The coordinate rail reports the active touch briefly, then returns to its system label. | Contact reporting remains immediate. |
| Signal handshake | `HomeCoordinates` + `app.css` | Coordinate-rail dwell, touch activation, or keyboard activation | The existing rail acknowledges a deliberate visitor pause with a short marker sequence and a temporary `SIGNAL-OK` status; the page grid and content order do not change. | The status changes immediately and the rail remains keyboard- and touch-usable without spatial animation. |

#### Cursor state matrix

The pack exposes only `data-cursor` hooks that the homepage and archive
surfaces can use honestly. Add a new state only when a corresponding native
interaction exists.

| State family | Hook values | Live consumer | Treatment |
| --- | --- | --- | --- |
| Reading and selection | `default`, `text` | Page shell, hero copy, and snippet code | Cream arrow and outlined I-beam. |
| Action | `pointer`, `link`, `button` | Native links and buttons | Native-feeling pointing hand with no decorative signal. |
| Media drag | `grab`, `grabbing` | Zoomed image viewport in `MediaModal`; explicit `AsyncImage` opt-in | Open and closed outlined hands; the active grip gets one amber contact point. |
| Status | `wait`, `progress`, `help`, `context-menu` | Loading snippets, preview loading, coordinate status, quick navigation, and the snippet tree | Hourglass, progress ring, help marker, and command-list marker. |
| Transfer and movement | `copy`, `alias`, `move`, `all-scroll` | Snippet copy action, external project links, gallery navigation, and zoomed media panning | Document copy, external alias, gallery movement, and pan cursors. |
| Geometry | `crosshair`, `cell`, `zoom-in`, `zoom-out` | Coordinate rail, tools table, media cards, and modal zoom control | Registration target, data-cell corners, and magnifiers with state-led amber marks. |
| Constraints | `not-allowed` | Disabled controls | High-contrast denial mark. |

### Reuse rules

- Reuse `--motion-feedback-duration`, `--motion-entry-duration`, and
  `--motion-ease` from [[design-system/tokens|Design tokens]] for future
  homepage feedback.
- Reuse the shared [[design-system/interaction-patterns|route interaction
  patterns]] when another public page needs pointer coordinates or archive-row
  feedback; `PointerCoordinates` owns the event and handshake lifecycle.
- Keep the shared marker order aligned with the public route sequence: Home
  first, Projects second, Certificates third. Do not turn the rail into a
  second progress widget.
- Use `:focus-within` for composite project interactions so keyboard and touch
  paths do not depend on hover.
- Keep coordinates and signal marks decorative with `aria-hidden="true"`; never
  put essential navigation or status only in them. The signal handshake is the
  exception: the rail is a native button with an accessible name and live
  announcement while its telemetry remains visual.
- Keep repeated project rendering data-driven through `HomeSelectedWork`; use
  `HomeIdentityPanel`, `HomeToolsTable`, and `HomeFooter` for their existing
  region responsibilities before creating new wrappers.
- Keep the motion layer CSS-first. Do not add a motion dependency, scroll
  hijacking, perpetual cursor trails, hidden content, card tilt, or
  `!important`. The operator cursor is CSS-first and bounded to fine pointers;
  keep SVG assets small with keyword fallbacks, and use browser defaults for
  touch or reduced-motion users.
- Keep the handshake bounded to one existing rail. Do not add a modal, overlay,
  new route, or a second progress indicator.

### Verification states

Verify the homepage at `1600x1000`, a narrow `390x844` viewport, keyboard focus
on every changed control, a touch contact, a mouse/pen coordinate update, and
the coordinate-rail handshake with `prefers-reduced-motion: reduce`. The
selected-work grid must keep its existing desktop columns, mobile stacking,
card order, and content height behavior.

## Verification

Use `http://localhost:5173/` for local content-backed screenshots. Verify at
least `1600x1000` and an emulated `390x844` viewport. Check the route with
loaded, loading, empty, and partial-error data; confirm no horizontal overflow,
console errors, or loss of keyboard focus. Run the repository typecheck, lint,
build, documentation check, and Graphify refresh after homepage changes.
