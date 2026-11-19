# Motion and interaction

## Motion budget

Assign motion to meaning:

- **Entry:** establish the page's hierarchy once; keep it short and non-blocking.
- **State:** make hover, focus, active, selected, loading, success, and error changes legible.
- **Navigation:** show where the user is and how a section changes.
- **Atmosphere:** use only when the composition is already clear without it.

If an effect cannot be explained as hierarchy, feedback, or orientation, remove it.

## Interaction rules

- Design the resting state, hover state, keyboard-focus state, pressed state, disabled state, and failure state together.
- Prefer opacity, color, transform, and clip-path changes that do not cause layout shift.
- Keep focus visible against the dark field and warm accent; never use hover as the only way to discover meaning.
- Make links, buttons, cards, and navigation targets have unambiguous hit areas and labels.
- Keep scroll natural. Do not hijack the wheel, trap the user in a horizontal track, or make essential content depend on parallax.
- Make decorative diagrams inert unless they communicate real information.

## Reduced motion

Honor `prefers-reduced-motion: reduce` or the framework equivalent. Remove nonessential entrance, parallax, looping, and scroll-linked motion; retain instant state changes and essential orientation cues. Verify that disabling motion does not remove content or make the route unusable.

## Implementation boundary

Start with CSS transitions and the existing animation primitives. Add a motion library only when the project already uses one or the interaction has a clear, tested need that CSS cannot express. Keep animation lifecycle, cleanup, and event listeners inside the component that owns them.
