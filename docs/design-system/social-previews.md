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

Social preview cards are committed `1200x630` PNG assets used by Syn-Forge's
Open Graph and Twitter metadata. The React component is the visual source of
truth; the PNGs are generated outputs that can be opened directly while
polishing the composition.

## Source and output contract

- `src/data/socialPreview.ts` owns the route metadata, route fallback, image
  dimensions, colors, avatar source, and existing public image-path contract.
- `src/components/socialPreview/SocialPreviewCard.tsx` owns the pure React TSX
  composition and accepts `SocialPreviewMetadata`.
- `SOCIAL_PREVIEW_AVATAR_URL` points at the profile image used by the site's
  identity surface; the avatar is baked into each PNG at generation time.
- `scripts/generate-social-previews.ts` renders the component with
  `renderToStaticMarkup`, captures Chromium at native size with Playwright,
  waits for `document.fonts.ready` and a successfully loaded avatar, and
  overwrites the generated PNGs.
- `functions/_middleware.ts` rewrites HTML metadata only. Static image requests
  are excluded from Functions and served by Pages as ordinary public files.
- `GlobalHeadManager` and the Pages HTML rewriter continue to use the existing
  image URLs, so no Open Graph URL contract changes.

Generated files remain at the current public URLs:

| Route | Generated file |
| --- | --- |
| Home | `public/social-image.png` |
| Projects | `public/projects/social-image.png` |
| Certificates | `public/certificates/social-image.png` |
| Snippets | `public/snippets/social-image.png` |
| Privacy | `public/privacy-policy/social-image.png` |
| Terms | `public/terms-and-conditions/social-image.png` |
| NetBird | `public/netbird/social-image.png` |
| Atelier | `public/atelier/social-image.png` |

The PNGs are checked in because normal builds must not require a browser. Run
the generator after changing the component or route copy, review the binary
outputs, and include the source and generated files in the same change.

## Generate and inspect

Install the Playwright browser once per workstation:

```bash
npx playwright install chromium
```

Then regenerate every route:

```bash
npm run generate:social-previews
```

To inspect the rendered files in the running site, start Vite and open
`/social-image.png` or any route-specific path directly. If the workstation
already provides a compatible Chromium executable, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute path before running the
generator. The generator fails clearly if the avatar cannot load, so a broken
identity image cannot be silently baked into a committed PNG.

The generator is intentionally explicit rather than part of `npm run build`.
This keeps production builds fast and browser-independent. If the site's
profile image changes, update `SOCIAL_PREVIEW_AVATAR_URL` and regenerate the
PNG set; static images do not fetch the avatar at request time.

## Visual contract

The card is a compact edition of the **Working Archive**: editorial hierarchy
first, technical notation second, and one warm signal.

| Level | Role | Treatment |
| --- | --- | --- |
| Signal | Route title and author identity | Large cream Newsreader title, stable measure, and a framed profile avatar. |
| Structure | Wordmark, route context, description, and URL | IBM Plex Sans/Mono, visible rules, route index, and a two-zone frame. |
| Atmosphere | Grid registration and depth | Near-black canvas, flat surface contrast, faint rules, and one amber registration mark. |

### Composition

- Keep the `1200x630` aspect ratio and generous inset so the title survives
  thumbnail cropping and link-unfurl padding.
- Use a ruled outer frame with a compact utility header, a dominant left
  content field, a distinct right identity field, and a low-contrast footer
  band.
- Show the route as a readable label and ordered `01 / 08` index derived from
  `SOCIAL_PREVIEW_ROUTES`.
- Treat the canonical profile avatar as the single graphic motif: keep it in
  the square-edged identity panel with the `Operator Syn` identity label, a
  small amber registration point, and aligned rules, matching the site's
  profile-image treatment.
- Keep route titles and descriptions as real text. Long copy may wrap, but the
  title remains the first meaningful visual read and the description stays
  bounded.
- Reserve amber for route signals, the identity registration point, and the
  archive call to action. Do not add gradients, glass, large rounded cards,
  additional artwork, or decorative noise.

### Type and palette

- Use Newsreader with a Georgia serif fallback for authored titles and the
  surrounding editorial wordmark.
- Use IBM Plex Sans with an Arial fallback for descriptions and supporting
  copy.
- Use IBM Plex Mono with a ui-monospace fallback for route indexes, paths, and
  footer metadata.
- Keep the semantic palette: `#101111` canvas, `#171918` surface,
  `#f2ede3` text, `#b7b1a7` muted text, `#7e7b74` faint text, and
  `#f0a42a` signal.
- Prefer rules and tonal separation over shadows. The image should remain
  recognizable when the amber motif is removed.

## Route and state inventory

| Case | Expected behavior |
| --- | --- |
| Home | `/social-image.png`, `01 / 08`, portfolio title, and current home description. |
| Public archive routes | Route-specific static PNG, ordered index, title, and description. |
| Descendant path | Inherits its top-level route's metadata and image path. |
| Unknown path | Uses the existing home fallback without changing the URL contract. |
| Long copy | Wraps within the left content measure without clipping the identity or footer. |
| Metadata/head | Existing URL, dimensions, content type, and alt text remain unchanged. |

The card is a static image. There are no hover, focus, keyboard, touch, or
reduced-motion states to implement; accessibility remains in the surrounding
HTML metadata and link destination.

## Verification

Run the focused contract and repository checks after regeneration:

- `npm run test:social-preview`
- `npm run typecheck`
- `npm run lint`
- `npm run check:biome:github`
- `npm run build`
- `npm run docs:check`
- `git diff --check`

Inspect home, projects, certificates, snippets, privacy, terms, NetBird, and
Atelier at native size and thumbnail scale. External social crawlers may retain
previous bytes for a period because the public image URLs are intentionally
unchanged; cache invalidation is outside this local asset workflow.
