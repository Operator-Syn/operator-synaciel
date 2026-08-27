# Repository-aware implementation

## Inspect first

Before editing, identify:

- framework, router, rendering mode, and styling approach;
- route entry point and neighboring components;
- design tokens, typography, asset pipeline, and icon conventions;
- data contracts and loading/error/empty states;
- responsive utilities and existing interaction primitives;
- lint, typecheck, test, build, and preview commands.

Follow the repository's conventions unless they block the requested result. Do not replace a working system with a personal preference.

## Build order

1. Create or refine the page shell and semantic landmarks.
2. Add the real content hierarchy and responsive layout.
3. Extract reusable primitives only after repeated structure is visible.
4. Add tokens for repeated values and state styles.
5. Add the graphic motif as a bounded, optional layer.
6. Add motion after static states are correct.
7. Remove dead styles, placeholders, and temporary debug output.

## Component boundaries

Keep a component when it owns a meaningful visual or interaction responsibility: navigation, project row, section header, status mark, diagram, or CTA. Avoid splitting every wrapper into a component or making the page depend on an abstract design system that the repository does not need.

Use data-driven rendering for repeated projects, navigation items, labels, or metrics. Keep content separate from presentation when that makes future editing safer; do not create an artificial CMS for static copy.

## Visual implementation

- Prefer semantic HTML, CSS layout, CSS custom properties, and inline SVG for precise marks.
- Preserve real text in the DOM; do not render important information into images or canvas.
- Use `currentColor`, accessible labels, and a single source of truth for repeated colors.
- Keep decorative layers `aria-hidden` when they provide no information and avoid pointer interception.
- Optimize images and respect the existing asset pipeline. Avoid adding large assets to imitate a reference when a small CSS/SVG treatment is enough.
- Keep the first meaningful content fast to render and prevent fonts or motion from blocking it.

## Verification

Run the repository's actual checks and report only the checks that ran. When a browser or preview is available, inspect the rendered result at representative widths and interact with every changed control. If visual verification is unavailable, state the limitation and compensate with focused static checks.
