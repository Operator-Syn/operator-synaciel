---
name: Operator-Syn
description: A dark editorial portfolio and learning journal for software work.
creative_north_star: The Working Archive
colors:
  canvas: "#101111"
  surface: "#171918"
  surface-raised: "#202321"
  text: "#f2ede3"
  text-muted: "#b7b1a7"
  text-faint: "#7e7b74"
  line: "rgb(242 237 227 / 18%)"
  line-strong: "rgb(242 237 227 / 35%)"
  signal: "#f0a42a"
  signal-strong: "#ffbb52"
  danger: "#d96a5c"
  success: "#98bd79"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(3.4rem, 8vw, 7rem)"
    fontWeight: 400
    lineHeight: 0.92
  pageTitle:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(2.6rem, 5vw, 5.2rem)"
    fontWeight: 400
    lineHeight: 0.98
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.06em"
rounded:
  control: "2px"
  panel: "4px"
spacing:
  contentWidth: "1440px"
  pageGutter: "clamp(1rem, 6.25vw, 6.25rem)"
  appShellTop: "5.5rem"
motion:
  feedbackDuration: "160ms"
  entryDuration: "480ms"
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
components:
  signalAction:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "0.65rem 0.9rem"
    minHeight: "2.65rem"
  quietAction:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.control}"
    padding: "0.65rem 0.9rem"
    minHeight: "2.65rem"
  surfacePanel:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.panel}"
---

# Design System: Operator-Syn

## Overview

Operator-Syn is a portfolio and learning journal for software work. Its visual
language is a dark editorial archive: authored work receives generous
Newsreader scale, while IBM Plex Sans and IBM Plex Mono keep descriptions,
indexes, coordinates, and controls precise.

**Creative North Star: "The Working Archive"**

The interface should feel like an indexed collection inside a calm technical
control room: visible rules make the structure legible, metadata establishes
orientation, and one warm amber signal communicates direction, selection,
focus, and action.

This document describes the incumbent implementation in
src/styles/app.css and the current route components. It is a source-grounded
design contract, not an invitation to restore the former blue-glass styling or
to add decorative surfaces that are not part of the system.

**Key Characteristics:**

- A near-black canvas with flat tonal surfaces and cream primary text.
- Newsreader for authored titles; IBM Plex Sans for reading copy and controls;
  IBM Plex Mono for technical metadata.
- Thin visible rules as the primary depth and grouping mechanism.
- Amber reserved for active state, direction, focus, and primary action.
- Editorial composition that remains responsive through bounded grids, row
  collapse, and deliberate mobile stacking.
- Motion as progressive enhancement: short feedback transitions, bounded entry
  choreography, and a complete reduced-motion path.

## Colors

### Neutral palette

- **Canvas (#101111):** Page background and default dark field.
- **Surface (#171918):** Panels, modal shell, and archive surfaces.
- **Raised surface (#202321):** Hover, focus, selected, and skeleton surfaces.
- **Text (#f2ede3):** Titles, primary copy, and readable controls.
- **Muted text (#b7b1a7):** Supporting descriptions and secondary controls.
- **Faint text (#7e7b74):** Technical metadata and low-emphasis labels.
- **Rule (rgb(242 237 227 / 18%)):** Default separators and grid lines.
- **Strong rule (rgb(242 237 227 / 35%)):** Control borders and stronger separators.

### Accent and state palette

- **Signal (#f0a42a):** Active links, indexes, primary actions, and selection.
- **Strong signal (#ffbb52):** Focus ring and high-emphasis interaction feedback.
- **Danger (#d96a5c):** Error and retry states.
- **Success (#98bd79):** Ready or successful system state.

**The Palette Rule.** Keep the neutral hierarchy intact and reserve amber for
movement through the archive, selected state, focus, and context-changing
actions.

Amber is semantic, not ornamental. Use it for movement through the archive,
the selected route, the active page or marker, focus, and an action that
changes context. Keep the neutral text hierarchy intact so a highlighted
element does not compete with all surrounding copy.

## Typography

The type system has three deliberate voices:

**Display Font:** Newsreader (with Georgia, serif)

**Body Font:** IBM Plex Sans (with system-ui, sans-serif)

**Mono Font:** IBM Plex Mono (with ui-monospace, monospace)

### Hierarchy

- **Display** (Newsreader, weight 400, clamp(3.4rem, 8vw, 7rem), line-height 0.92):
  Home hero and major authored statements.
- **Page title** (Newsreader, weight 400, clamp(2.6rem, 5vw, 5.2rem), line-height 0.98):
  Route headings and archive titles.
- **Body** (IBM Plex Sans, weight 400, 1rem, line-height 1.55):
  Descriptions, explanatory copy, and data values.
- **Metadata** (IBM Plex Mono, weight 400, 0.72rem, line-height 1.3):
  Indexes, coordinates, media types, dates, and controls.

**The Type Rule.** Give authored titles serif scale and give technical
orientation mono precision; do not make body copy behave like a label.

Headings use Newsreader at weight 400. They are not treated as UI labels:
allow their serif rhythm to carry hierarchy, use bounded maximum widths, and
apply text-wrap: balance where the current implementation needs controlled
title breaks. Body copy uses text-wrap: pretty where supported and remains
readable without relying on manual line breaks.

Mono metadata uses uppercase and restrained letter spacing. It is for
orientation, not paragraphs. Body text should not be converted to all caps,
and display titles should not inherit the mono treatment.

## Layout

The layout is a ruled frame rather than a collection of floating cards.

**The Frame Rule.** Use visible rules, bounded gutters, and intentional empty
space to establish grouping before adding another surface or shadow.

- The main content frame is capped at 1440px with
  clamp(1rem, 6.25vw, 6.25rem) horizontal gutters.
- Wide compositions may use a 1600px frame, while the document remains
  readable at the 20rem minimum viewport.
- The application shell reserves 5.5rem above page content for the shared
  header and keeps a small bottom allowance for fixed navigation.
- 1px rules establish section boundaries, archive columns, modal bands, and
  metadata groupings. Empty space is intentional: it separates editorial
  blocks without requiring a filled panel.
- Panels are flat and rectangular with only a small control or panel radius.
  Avoid turning every row into a rounded card.

### Route composition

Home uses a two-column hero: the authored hero copy and a technical identity
side. At 1100px it becomes a single vertical flow. The selected-work grid
stacks its cards at 900px. The footer changes from a horizontal information
band to a readable metadata-and-social flow at 1480px and 640px.

Projects uses a row-based archive. At wide sizes a row carries the index, media,
description, and action rail. The project archive container collapses the
action rail into a ruled lower band below 1239px; below 800px, each project
becomes a vertical sequence of index, media, copy, and actions. The mobile
version removes the desktop vertical editorial separators and keeps the row
highlight aligned to the full row boundary.

### Interaction spacing

Fixed quick navigation uses safe-area-aware edge spacing and stays clear of
pagination and content. Its open state becomes a width-constrained panel on
narrow screens rather than forcing a desktop-width layout.

Interaction targets keep a practical minimum: action buttons and media controls
use approximately 2.65rem to 2.75rem minimum height, while the fixed quick
navigation toggle is at least 3rem high.

## Elevation & Depth

The default depth model is tonal and structural:

- Canvas to surface: #101111 to #171918.
- Surface to raised surface: #171918 to #202321.
- Rules provide most separation; use --color-line before introducing a
  stronger border.
- **Panel shadow** (box-shadow: 0 1.25rem 3rem rgb(0 0 0 / 25%)): Reserved
  for the floating quick-navigation panel.
- **Media shadow** (box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 30%)): Reserved
  for the media dialog.
- The media dialog may use a dark translucent backdrop and restrained blur to
  isolate the active work. The page itself should not become a glass surface.

Do not use shadows to make every archive row appear elevated. A row earns
emphasis through its full-width raised surface, rule, amber state, or media
feedback.

## Shapes

- Controls use --radius-control: 2px.
- Panels and modal shells use --radius-panel: 4px.
- Archive rows, coordinate rails, and section bands are intentionally
  square-edged.
- Borders are normally 1px; strong borders are reserved for controls,
  selected states, focus, and dialog boundaries.
- Focus is a 2px --color-signal-strong outline with a 3px offset. It must
  remain visible against both canvas and raised surfaces.
- **The Edge Rule.** Keep archive rows, coordinate rails, and section bands
  square-edged; reserve small radii for controls and bounded panels.
- The system has no !important styling rule. Resolve conflicts through
  component ownership, cascade order, and specific semantic selectors.

## Components

### Shared header and route frame

The header establishes the wordmark, route navigation, and mobile menu without
competing with the page title. The active route uses the signal color and a
visible underline or equivalent state. The page frame owns the horizontal
gutter; individual components should not invent unrelated outer margins.

### Coordinate rail

The coordinate rail is a small technical instrument, not a hero decoration. It
uses mono metadata, a ruled horizontal frame, marker ticks, and a single amber
diamond pointer signal. On narrow screens the marker array and pointer signal
are removed when they would compete with content, while the coordinate/status
labels remain legible.

The homepage rail also carries a bounded handshake state. Its marker animation
is feedback for the page's active section, not a continuously running ambient
effect.

### Signal and quiet actions

action-signal is the filled amber action: compact mono label, dark text, a
small gap for an icon, and a 2px radius. action-quiet is the outlined
alternative with a transparent background and strong neutral rule. Both use a
short feedback transition and a one-pixel upward hover lift.

Use an icon to clarify direction or context, not to replace the text label.
Links that move through the archive use amber text and a directional arrow;
secondary gallery/case-study actions remain muted until focused or hovered.

### Project archive row

Each archive row is a ruled editorial unit. Its index is Newsreader, its media
is a bordered 2.7 aspect-ratio preview, its description has a left rule on
wide layouts, and its action rail holds media type, project link, and gallery
entry. Hover and focus-within feedback operate on the row as a whole: the
background raises, the index/title signal amber, and the related media may
scale by only 1.025.

The row's ::before feedback layer must cover the same bounds as the row. It
must not be narrower than the content or leave the index/action rail outside
the highlighted surface.

### Quick navigation

The floating application control is a safe-area-aware, fixed utility. The
closed control is a compact bordered surface with home and list affordances.
The open panel uses a ruled header, two category tabs, and numbered links.
Active tabs and routes use the raised surface plus amber signal. On mobile the
panel is constrained to the viewport and the toggle remains separated from
content and pagination.

### Media modal

The media dialog is a large, centered surface capped at 90rem and bounded by
the viewport. Its hierarchy is header, media stage, optional slide navigation,
details, and actions. The media stage gets the largest share of available
space; the details copy uses the full remaining text column and can scroll
within a bounded area. Navigation and zoom controls stay close to the media
rather than creating a second editorial rail.

The dialog owns focus, closes on Escape or backdrop click, restores the
previously focused element, and supports keyboard slide navigation. Image
zooming enables pointer panning only while zoomed; touch keeps native touch
behavior available.

### Loading and error states

Loading states use quiet raised blocks and preserve the eventual geometry.
Errors use --color-danger, a short ruled message, and an explicit retry
action. An inline refresh failure should not erase already visible archive
content.

## Do's and Don'ts

### Do

- Use the semantic tokens from src/styles/app.css.
- Let Newsreader titles breathe while keeping their maximum width bounded.
- Use IBM Plex Mono for coordinates, indexes, dates, media types, and compact
  controls.
- Make the full interactive row communicate focus or hover state.
- Preserve usable keyboard focus, reduced-motion behavior, and touch-safe
  controls.
- Keep the amber signal meaningful and sparse.
- Test long project titles, missing media, loading, errors, narrow screens, and
  fixed navigation overlap.

### Don't

- Reintroduce blue glass, decorative gradients, badge walls, or large rounded
  cards.
- Use amber as a general text color for every label.
- Hide the only readable label behind an icon.
- Make a highlight layer smaller than the row it describes.
- Use layout-driving animation, continuous cursor trails, or motion that blocks
  content.
- Add page-local color tokens when an existing semantic role applies.
- Depend on !important to resolve visual conflicts.
- Treat reference images as API or database requirements; the current response
  shapes remain authoritative.
