---
title: Route Interaction Patterns
aliases:
  - Shared interactions
  - Coordinate rail
tags:
  - design-system
  - interaction
  - responsive
role: contract
---

# Route Interaction Patterns

Public routes share a small interaction grammar so the portfolio feels like
one instrument rather than a collection of unrelated page effects. The
current contract is implemented on Home, Projects, Certificates, and Snippets.

## Pointer coordinate rail

[`PointerCoordinates`](../../src/components/pointerCoordinates/PointerCoordinates.tsx)
is the shared source for the coordinate/status rail. Home uses the
`HomeCoordinates` wrapper with the first marker active; Projects uses the same
component with the second marker active; Certificates uses the third marker;
Snippets uses one marker for the file-index workspace.

The rail:

- reports viewport pointer coordinates for mouse and pen input;
- hands off browser-owned native PDF viewers explicitly: while that surface is hovered, the rail clears X/Y and its registration mark and labels the viewer instead of showing stale coordinates;
- reports `TOUCH` briefly for an active touch contact, then returns to the
  system label;
- moves one registration mark from the actual pointer position using a
  request-animation-frame update, without a trailing overlay or positional
  easing, and re-clamps that mark when the rail resizes;
- accepts a deliberate mouse/pen dwell, touch activation, or keyboard click as
  a bounded signal handshake and announces completion accessibly;
- cancels a touch handshake when the contact moves beyond the existing
  tolerance; and
- keeps the coordinate text and handshake usable when reduced motion is
  enabled.

Use `activeSection` and `markerCount` only for real orientation landmarks. Do
not persist coordinates, marker labels, or generated status copy in the API or
database. If a route has no meaningful section landmarks, use a single marker
rather than inventing a progress system.

## Archive row feedback

Archive rows use a row-sized `::before` surface for hover and `:focus-within`
feedback. It follows the actual row box, including its bottom rule, so the
highlight does not read as a smaller card nested inside the record. The row's
existing padding and grid gaps provide the breathing room for its number, media,
copy, and actions. The number and title use the existing amber signal and a
restrained upward shift, matching Home's selected-work feedback without
changing grid tracks or causing layout shift.

The state must remain understandable through keyboard focus and touch input;
hover is only an additional fine-pointer affordance. Interactive records expose
a full-row click surface around the content for a generous target, while media
controls and explicit project or credential actions remain separate hit areas.
Keep those actions in their existing DOM order.

Certificates use the same full-record feedback contract in a two-column grid
above their content-fit breakpoint. A certificate record keeps its index,
contained media, copy, and credential link together; on narrower frames the
grid becomes one column and then each record stacks into index, media, copy,
and action bands. The credential link uses the existing `alias` cursor state,
while the preview media uses `zoom-in` to open the shared media modal.

The archive shell uses its own inline-size container for the structural
breakpoint. When the available frame is below `1240px`, the action rail moves
below the media and copy instead of overflowing the frame; the existing
`800px` mobile rule then stacks the record into a single readable column. This
keeps the transition tied to the page frame rather than to the browser viewport
alone.

Projects and Certificates use the same cursor-control grammar: the visible
range is derived from the server total and current page size, the next action
uses the opaque `next_cursor`, and the previous action uses the locally
retained cursor history. The controls do not reconstruct offsets or expose
cursor values.

The Projects archive appends a display-only `Still cooking` row after the final
cursor page. It is not stored in D1 and does not participate in the API cursor
or server total; the route adjusts the visible range to include the extra
presentation card without changing real-project pagination.

## Loading and pending states

Loading is a visual state, not a visible word repeated across the interface. Public routes and reusable loading-capable components use the shared loading primitives in
`src/components/loadingState/LoadingState.tsx` and
`src/styles/loading-state.css`.

- Preserve the destination geometry with ruled, raised neutral blocks.
- Use a restrained amber signal pulse and glint as the only loading motion.
- Keep stale archive content visible during background refetches; signal pending work beside the existing controls.
- Use format-aware placeholders for media, Markdown, PDF, document metadata, file indexes, and syntax highlighting.
- Keep status announcements available to assistive technology through visually hidden
  `role="status"` content and `aria-busy`; do not expose loading copy in the visual layout.
- Respect `prefers-reduced-motion`: retain the state distinction while removing continuous movement.
- Do not change API contracts, route behavior, cursor mappings, or interaction handlers to add loading feedback.

## Snippets archive workspace

The Snippets route uses a persistent two-pane file-index workspace rather than
a modal. The left pane establishes the path and file inventory; the right pane
keeps a bounded preview available for reading without turning the archive into
a full document reader.

- The shared coordinate rail sits between navigation and the workspace.
- Breadcrumbs, the `Index of /snippets/` heading, path, description, and
  NAME/MODIFIED/SIZE columns make the current location explicit.
- Folders navigate to canonical `/snippets/<name>/` paths. The legacy
  `/snippets/root/...` form remains readable and normalizes to the canonical
  route.
- Folder and file records use one keyboard-focusable button spanning the full
  three-column row. Its hover, focus, and selected surface is inset so the
  content keeps deliberate breathing room.
- Selecting a file fetches the tree and bounded preview metadata separately.
- The preview header exposes the format, full path, Download, Close, and
  Read more actions. The archive uses `/api/v2/snippets/:id/preview` for
  Markdown excerpts and reserves complete content for Download or the
  canonical `/snippets/document/<id>/<slug>/` route.
- The preview body has a fixed responsive boundary with its own vertical
  scroll. A long excerpt therefore does not grow the workspace or push the
  index out of view. Empty, loading, and error states remain inside this
  bounded surface.
- Markdown previews retain readable content padding and code-block Copy
  actions. PDF previews use the available preview surface without changing
  the legacy download contract.
- At the `960px` content breakpoint the panes stack vertically. At
  `640px`, row metadata moves below the file name and the preview controls
  stack while preserving hit-area size.
- The shell keeps bottom breathing room for the floating quick-navigation
  control and does not create horizontal overflow on narrow frames.

The dedicated document route is the shareable/indexable full-content surface.
It uses the same Markdown renderer, emits canonical metadata, and normalizes a
stale filename slug back to the current route. The old unversioned snippet
routes remain compatible; v2 is additive.

See [[design-system/snippets-fidelity|Snippets fidelity]] for the complete
route-specific composition and verification contract.

## Media content modal

The shared `MediaModal` is a media-first project dossier rather than a narrow
editorial text card. On desktop it can grow to a `90rem` ceiling and gives the image or video viewport the largest flexible share of the dialog. The header remains legible without consuming the inspection surface, while the description uses the full remaining text measure below the media.

Image media opens at a complete fit-to-frame view. The integrated viewer then supports:

- wheel zoom with the pointer as the focal point;
- pinch zoom and one-finger drag on touch once the image is enlarged;
- mouse or pen drag while enlarged;
- double-click or double-tap to move between fit and an enlarged inspection view;
- bounded `Zoom in`, `Zoom out`, percentage, and `Reset` controls beside the
  media; and
- `+`, `-`, and `0` keyboard controls for zoom and reset.

Zoom and pan are contained inside the media region with transform-based movement, so the page does not acquire a second scroll surface or lose the image's fit context. The viewer hint and controls recede to a semi-transparent idle state, then return to full contrast on hover, keyboard focus, or active pointer, wheel, touch, and keyboard input without changing their hit areas. Video media keeps its native controls and does not expose image zoom affordances. Gallery changes reset the image view, and Escape, keyboard focus looping, focus restoration, backdrop close, reduced motion, and 44px-class controls remain part of the shared modal contract.

On mobile, the header and label rail compress deliberately but the image stage remains the primary surface. The media toolbar stays reachable without covering the image's focal area, safe-area padding is honored, and touch gestures are enabled only inside image media so ordinary modal controls retain native activation behavior.

## Adoption checklist

When another public page adopts these patterns:

1. Reuse `PointerCoordinates`; do not copy its pointer listeners or handshake
   timers into a route component.
2. Mount the rail after the shared navigation and before the route's primary
   content band.
3. Choose marker landmarks from the page's actual reading order and keep the
   route modifier responsible only for local spacing or borders.
4. Use the row-sized state surface and the record's internal padding for
   repeated archive/list feedback; do not create a smaller card inside the
   record.
5. Verify mouse, pen, touch, keyboard focus, reduced motion, loading/error/
   empty states, and narrow-width overflow before extending the pattern.

See [[design-system/homepage-fidelity|Homepage fidelity]] for the original
Home motion contract and [[design-system/tokens|Design tokens]] for the shared
motion, color, type, and focus roles.
