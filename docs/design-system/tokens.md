---
title: Design Tokens
aliases:
  - CSS variables
  - Visual tokens
tags:
  - design-system
  - css
role: concept
---

# Design Tokens

The global token source is `apps/portfolio-web/src/styles/tokens.css`, imported by `apps/portfolio-web/src/styles/app.css`. Tailwind theme variables
generate utilities; semantic variables are used by component CSS and inline
style boundaries.

Typography roles are documented in [[design-system/typography|Typography]], and
Tailwind's token boundary is in [[design-system/tailwind|Tailwind Conventions]].
Both are part of the [[design-system/README|Design System]] contract.

## Color roles

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#101111` | Page background |
| `--color-surface` | `#171918` | Panels and archive surfaces |
| `--color-surface-raised` | `#202321` | Hover and selected surfaces |
| `--color-text` | `#f2ede3` | Primary text |
| `--color-text-muted` | `#b7b1a7` | Supporting text |
| `--color-text-faint` | `#7e7b74` | Metadata and atmosphere |
| `--color-line` | `rgb(242 237 227 / 18%)` | Default rules |
| `--color-line-strong` | `rgb(242 237 227 / 35%)` | Active separators |
| `--color-signal` | `#f0a42a` | Active links and primary actions |
| `--color-signal-strong` | `#ffbb52` | Focus and high emphasis |
| `--color-danger` | `#d96a5c` | Error state |
| `--color-success` | `#98bd79` | Ready and success state |

## Visitor preferences

The Home route exposes a fixed settings utility; it does not add layout flow.
Home Settings and Quick Navigation share the same safe-area-aware viewport edge
tokens so their triggers keep a consistent inline/block anchor across routes.
Dalan is the default theme. Of Times Old is an opt-in pastel blue-hour palette
newly composed from the prior portfolio's blue as visual reference only. It
remaps semantic color roles without restoring former spacing, type, imagery, or
component structure. Its structural roles stay monochrome blue; danger and
success retain distinct softened hues so status is not color-ambiguous. Theme
and explicit reduced-motion choices are stored in browser-local storage.
Turning reduced motion off removes the explicit override but still honors the
operating system preference.

Its current palette is intentionally lighter and more muted than the legacy
surface:

| Role | Value | Use |
| --- | --- | --- |
| Of Times Old canvas | `#173248` | Lighter blue-black page field |
| Of Times Old surface | `#244a60` | Slate-blue panels and archive surfaces |
| Of Times Old raised | `#2f6276` | Dusty blue hover and selected surfaces |
| Of Times Old text | `#f0f6f4` | Soft paper-blue primary text |
| Of Times Old muted | `#c9dfe1` | Supporting copy |
| Of Times Old signal | `#b8e3e6` | Pastel-blue actions and active states |
| Of Times Old focus | `#dbf4f3` | High-emphasis focus feedback |

Vesper Index is a rose-led twilight theme composed from the Twilight-5 sunset
balance rather than copied as a raw swatch list. Its darker structural blue keeps
the existing ruled surfaces readable, while lifted rose and blush values preserve
contrast for active states and controls:

| Role | Value | Use |
| --- | --- | --- |
| Vesper Index canvas | `#292831` | Violet-charcoal page field |
| Vesper Index surface | `#333f58` | Midnight slate panels |
| Vesper Index raised | `#3a5068` | Contrast-safe twilight hover and selected surfaces |
| Vesper Index text | `#fff4ef` | Blush-tinted paper primary text |
| Vesper Index muted | `#fbbbad` | Supporting copy |
| Vesper Index signal | `#f7b0b5` | Rose active states and actions |
| Vesper Index focus | `#ffd7ce` | High-emphasis focus feedback |
| Vesper Index danger | `#ffad9e` | Error state |
| Vesper Index success | `#acd0d3` | Ready and success state |

Built-in depth follows each palette's structural field: Dalan retains neutral
black shadows, Of Times Old uses its blue canvas tint, Vesper Index uses its
violet-charcoal canvas tint, and The Ancient Blue Ledger uses its dark ledger
ink. The shadow geometry stays fixed across all themes; only tint and opacity
change.

The Ancient Blue Ledger is a permanent built-in light theme promoted from the
local custom-theme format. It keeps the same layout, typography, motion, routes,
media, and cursor behavior while shifting the semantic surfaces toward a pale
ledger blue:

| Role | Value |
| --- | --- |
| Canvas / surface / raised | `#c9ddf7` / `#d9e7fa` / `#edf4fd` |
| Text / muted / faint | `#13263a` / `#304b66` / `#58718a` |
| Line / strong line | `#304b6640` / `#13263a66` |
| Signal / strong signal | `#1a4f8a` / `#103b6b` |
| Danger / success | `#6e3b50` / `#345b4f` |
| Overlay roles | `#c9ddf7eb`, `#c9ddf7d6`, `#c9ddf7f5`, `#c9ddf7db` |
| Signal soft | `#1a4f8a1f` |
| Panel / media / viewer shadow | `#13263a33` / `#13263a47` / `#13263a3d` |

## Local custom theme document

Visitors may author a browser-local custom palette with the versioned JSON document format below. This is a local document contract, not an HTTP API and not a new `/api/v2` route.

~~~json
{
  "version": 1,
  "name": "My theme",
  "colors": {
    "canvas": "#101111",
    "signal": "#f0a42a"
  },
  "shadows": {
    "panel": "#00000040",
    "media": "#0000004d",
    "viewerTools": "#0000003d"
  }
}
~~~

`version` must be `1`. `name` is optional, defaults to `Custom theme`, and is trimmed to 48 characters. `colors` must contain at least one supported role. Missing roles inherit Dalan, so a document may override only the values it needs.

The public keys are semantic names rather than arbitrary CSS custom properties:

| JSON key | CSS variable | Use |
| --- | --- | --- |
| `canvas` | `--color-canvas` | Page background |
| `surface` | `--color-surface` | Panels and archive surfaces |
| `surfaceRaised` | `--color-surface-raised` | Hover and selected surfaces |
| `text` | `--color-text` | Primary text |
| `textMuted` | `--color-text-muted` | Supporting text |
| `textFaint` | `--color-text-faint` | Metadata |
| `line` | `--color-line` | Default rules |
| `lineStrong` | `--color-line-strong` | Strong separators |
| `signal` | `--color-signal` | Actions and active states |
| `signalStrong` | `--color-signal-strong` | Focus and emphasis |
| `danger` | `--color-danger` | Error states |
| `success` | `--color-success` | Ready states |
| `canvasOverlay` | `--color-canvas-overlay` | Modal overlay |
| `canvasOverlaySoft` | `--color-canvas-overlay-soft` | Soft overlay |
| `canvasOverlayStrong` | `--color-canvas-overlay-strong` | Strong overlay |
| `canvasOverlayNavigation` | `--color-canvas-overlay-navigation` | Navigation overlay |
| `signalSoft` | `--color-signal-soft` | Subtle signal tint |

Structural and readable roles accept opaque `#RRGGBB` values. Rule, overlay, and soft-signal roles also accept `#RRGGBBAA` values when transparency is needed.

Shadow keys are optional and inherit Dalan when omitted. Their values are
hexadecimal tints with optional alpha; the shadow geometry remains fixed so a
custom document changes only depth and opacity, not layout:

| JSON key | CSS variable | Use |
| --- | --- | --- |
| `panel` | `--shadow-panel` | Settings, navigation, document, and policy panels |
| `media` | `--shadow-media` | Media modal shell |
| `viewerTools` | `--shadow-viewer-tools` | Media viewer controls |

The loader parses JSON as data only. It rejects unknown fields, unknown roles, prototype-pollution keys, control characters in names, oversized documents, malformed JSON, and non-hex values. Any valid hexadecimal color combination may be applied; contrast is not a blocking rule, so experimentation is not limited to a predefined palette. When a resolved palette falls below the suggested readability ratios, the editor reports those findings as optional suggestions. Invalid input never changes the active theme.

Only the allowlisted semantic variables are applied to the document root. The Markdown renderer maps its syntax-token colors to the same semantic roles, so custom palettes also reach highlighted code. Fonts, spacing, type scale, motion, layout, cursor SVGs, media content, and browser-owned PDF/video controls are outside this contract. Shadow geometry remains fixed; only the allowlisted shadow tint and opacity can change.

Custom documents are normalized before browser-local storage. They remain local to the current origin and can be exported as JSON for manual sharing; no custom theme data is sent to the Worker or stored in D1/R2.

Do not introduce page-local replacements for these roles. The design should
remain recognizable without decorative texture or diagram marks.

## Type and shape roles

- `--font-display` is used for hero, page, and project titles.
- `--font-body` is used for reading text and controls.
- `--font-mono` is used for indexes, paths, dates, media types, and code.
- `--radius-control` is `2px`; `--radius-panel` is `4px`.
- `--focus-ring` uses `--color-signal-strong` with a visible offset.
- Shadows are reserved for dialogs, selected media, and their viewer controls;
  custom documents can tune their black tint and opacity without changing
  their fixed geometry.

## Motion roles

| Token | Value | Use |
| --- | --- | --- |
| `--motion-feedback-duration` | `160ms` | Hover, focus, active-marker, and pointer-signal feedback |
| `--motion-entry-duration` | `480ms` | Non-blocking homepage entry choreography |
| `--motion-theme-transition-duration` | `320ms` | Full-cover theme handoff |
| `--motion-ease` | `var(--ease-editorial)` | Confident editorial arrivals and bounded state changes |

Motion is progressive enhancement. Keep content visible without the enhancement
class, use transforms/opacity/clip-path instead of layout-driving properties,
and provide a `prefers-reduced-motion` path that preserves state feedback. Theme
switches use a fixed, out-of-flow wipe: it covers the viewport in 120ms, holds
for an 80ms handoff, applies the new palette at the midpoint of that hold, and
reveals it over the remaining 120ms. A signal-colored edge identifies the
movement without covering interaction targets.

## Usage rules

1. Use semantic roles such as `bg-canvas`, `text-text`, and `text-signal` in
   Tailwind markup.
2. Use `var(--color-...)` inside complex CSS such as Markdown and media states.
3. Keep the theme's signal role for direction, selection, focus, and primary action; Dalan uses amber, Of Times Old uses pastel blue, Vesper Index uses rose, and The Ancient Blue Ledger uses ledger blue.
4. Keep Dalan as the default; built-in alternate themes may override semantic
   palette roles and, where documented, shadow tint only.
5. Do not restore the former blue glass layout, badge-wall styling, or large
   rounded cards in redesigned routes.
6. Keep spacing and type sizes bounded; test long titles and narrow screens.
