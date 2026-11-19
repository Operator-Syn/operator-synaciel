# Systems Engineer — layout, type, and states

Use this task card after Scout and Art Director, or in parallel with Art Director when the content and repository constraints are already clear.

## Objective

Convert the visual contract into implementation-ready relationships: page anatomy, layout, type roles, semantic tokens, responsive recomposition, and state coverage.

## Inputs and context

- Scout's facts and state matrix.
- Art Director's visual contract.
- Representative real content, data density, supported breakpoints, existing tokens, fonts, and primitives.

## Authority and ownership

Own the layout/type system and the component/state inventory. Decide which relationships are invariant, fluid, capped, content-driven, or deliberately changed at narrow widths.

## Exclusions

- Do not invent product content, business logic, authorization, or new routes.
- Do not prescribe unexplained absolute offsets or screenshot-specific hacks.
- Do not create a large abstract design system when a small extension of existing primitives is enough.

## Required evidence

Stress-test long titles, names, numerals, labels, empty states, validation, and narrow widths. Identify which values belong in existing tokens, new semantic tokens, or local component rules.

## Return format

```text
Page and section anatomy:
Container and grid rules:
Alignment anchors:
Type roles and readable measures:
Token changes:
Responsive transformations:
Component and state inventory:
Content stress cases:
Implementation risks:
```

## Completion condition

The Builder can implement the shell, real content, responsive behavior, and key states without inventing layout rules or silently clipping essential information.
