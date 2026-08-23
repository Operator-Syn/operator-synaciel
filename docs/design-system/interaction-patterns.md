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
current contract is implemented on Home and Projects and is intended for the
remaining public routes when their existing layouts are refined.

## Pointer coordinate rail

[`PointerCoordinates`](../../src/components/pointerCoordinates/PointerCoordinates.tsx)
is the shared source for the coordinate/status rail. Home uses the
`HomeCoordinates` wrapper with three section markers; Projects uses the same
component with one archive marker and a route-specific visual modifier.

The rail:

- reports viewport pointer coordinates for mouse and pen input;
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
hover is only an additional fine-pointer affordance. Keep the content, media,
and action hit areas in their existing DOM order.

The archive shell uses its own inline-size container for the structural
breakpoint. When the available frame is below `1240px`, the action rail moves
below the media and copy instead of overflowing the frame; the existing `800px`
mobile rule then stacks the record into a single readable column. This keeps the
transition tied to the page frame rather than to the browser viewport alone.

## Media content modal

The shared `MediaModal` is a wide project dossier rather than a narrow
editorial text card. On desktop it can grow to a `90rem` ceiling, gives the
media viewport a bounded height, and places the real description in a
full-measure copy column beside its detail label. On mobile, that label rail
collapses above the copy and the action group remains usable at the bottom.

Zoom and pan remain contained inside the media region; gallery controls,
Escape, keyboard focus looping, and reduced-motion behavior remain part of the
shared modal contract.

On collapsed-navigation widths, the archive record reads as `index and type`,
then media, copy, and actions. The fixed header may retract while reading down
the archive and return when the visitor scrolls up; Quick Navigation remains a
viewport-fixed bottom-right FAB so it does not jump into the header zone.
Focused controls and open menus keep their orientation surface visible.

Routes that expose the fixed Quick Navigation control must reserve bottom
clearance for it. Projects keeps `6rem` of shell padding after pagination and
docks the control outside the content frame with a responsive edge offset and
safe-area allowance. At `<= 1400px` it becomes a compact square; when the
primary navigation collapses at `<= 1023px`, it remains bottom-right rather
than inheriting the header's scroll state. Open panels use the same edge rhythm
and stay within the viewport.

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
