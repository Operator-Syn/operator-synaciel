# Layout and type system

## Start with relationships

Define the following before writing detailed component CSS:

- page max width and side padding;
- column count and alignment anchors;
- section rhythm and rule placement;
- title, section heading, body, metadata, and action roles;
- primary, secondary, muted, and accent colors;
- narrow-screen re-composition rules.

Prefer a small token set with clear roles over dozens of one-off values. Use CSS custom properties or the repository's equivalent token system.

## Composition heuristics

- Let the main title occupy a deliberate measure; do not force every line to span the viewport.
- Align labels, titles, metadata, and rules to a repeatable edge or column.
- Use empty space to separate narrative beats, not as a substitute for missing content.
- Let a section change one of three things—scale, alignment, or color temperature—so the page has progression without constant novelty.
- Use borders and rules where they clarify relationships. Use surfaces only when they establish grouping or interaction.
- Keep the decorative technical layer subordinate to the content grid and remove it cleanly at narrow widths if necessary.

## Typography heuristics

- Pair a display role with a highly legible reading role; a mono or condensed utility role is optional.
- Establish a clear contrast in size, weight, width, or case—not all four at once.
- Test real strings, long names, numerals, punctuation, and mixed-case labels.
- Control line length for reading text and use `text-wrap: balance` or the project equivalent only where it improves the title.
- Prefer a font already present in the project or a reliable, licensed source. Do not add a font merely because a reference uses one.
- Treat letter spacing and line height as part of the voice; inspect them at actual rendered sizes.

## Responsive composition

Do not shrink the desktop artboard until it fits. Decide what changes on smaller screens:

- collapse columns into a readable order;
- move metadata below the title or into a compact row;
- reduce decorative marks and rule density;
- change display type with a fluid clamp, bounded by readable extremes;
- keep the primary action visible without competing with navigation;
- preserve the strongest alignment cue even when the grid simplifies.

Validate at a narrow phone, a large phone/tablet, a laptop, and a wide desktop. Use the repository's supported breakpoints when they exist.
