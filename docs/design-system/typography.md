---
title: Typography
aliases:
  - Type system
tags:
  - design-system
  - typography
role: concept
---

# Typography

The selected type system avoids the common generic portfolio pairing while
keeping the page readable and technical:

- **Newsreader** - editorial display role for hero and archive titles.
- **IBM Plex Sans** - body, navigation, controls, and descriptions.
- **IBM Plex Mono** - paths, indexes, dates, media types, and code metadata.

## Loading

Fonts are loaded from the external provider in `index.html` with
`display=swap`. Every role has a local fallback so the page remains readable
when the provider is blocked or unavailable.

Fallbacks are part of the contract:

- Newsreader -> Georgia -> generic serif
- IBM Plex Sans -> system sans-serif
- IBM Plex Mono -> system monospace

Do not hide body content while fonts load. Test title wrapping with both the
web fonts and fallbacks.

## Hierarchy

- Display: large, bounded, high-contrast title used once per route.
- Heading: section and archive titles with a clear reading measure.
- Body: comfortable paragraph length and line height.
- Metadata: compact uppercase or monospace labels with reduced contrast.

Letter spacing is zero by default. Tracking is added only to metadata labels
where it improves scanning. Avoid all-caps body copy and avoid using display
type for controls.
