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

The global token source is `src/styles/app.css`. Tailwind theme variables
generate utilities; semantic variables are used by component CSS and inline
style boundaries.

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

Do not introduce page-local replacements for these roles. The design should
remain recognizable without decorative texture or diagram marks.

## Type and shape roles

- `--font-display` is used for hero, page, and project titles.
- `--font-body` is used for reading text and controls.
- `--font-mono` is used for indexes, paths, dates, media types, and code.
- `--radius-control` is `2px`; `--radius-panel` is `4px`.
- `--focus-ring` uses `--color-signal-strong` with a visible offset.
- Shadows are reserved for dialogs and selected media, not every section.

## Motion roles

| Token | Value | Use |
| --- | --- | --- |
| `--motion-feedback-duration` | `160ms` | Hover, focus, active-marker, and pointer-signal feedback |
| `--motion-entry-duration` | `480ms` | Non-blocking homepage entry choreography |
| `--motion-ease` | `var(--ease-editorial)` | Confident editorial arrivals and bounded state changes |

Motion is progressive enhancement. Keep content visible without the enhancement
class, use transforms/opacity/clip-path instead of layout-driving properties,
and provide a `prefers-reduced-motion` path that preserves state feedback.

## Usage rules

1. Use semantic roles such as `bg-canvas`, `text-text`, and `text-signal` in
   Tailwind markup.
2. Use `var(--color-...)` inside complex CSS such as Markdown and media states.
3. Keep amber for direction, selection, focus, and primary action.
4. Do not restore the former blue glass palette, badge-wall styling, or large
   rounded cards in redesigned routes.
5. Keep spacing and type sizes bounded; test long titles and narrow screens.
