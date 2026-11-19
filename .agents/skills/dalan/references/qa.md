# Dalan QA checklist

Use evidence, not confidence. Record the viewport, route, state, and check used for each finding.

## Visual

- Does the first viewport establish the subject, context, and primary action?
- Does the type scale create a clear signal/structure/atmosphere hierarchy?
- Are alignment anchors, rules, gaps, and section transitions intentional?
- Is the warm accent reserved for meaningful signals?
- Does the interface remain recognizable when decorative diagrams and texture are hidden?
- Are long titles, names, numbers, and empty states designed rather than incidental?

## Responsive

- Check a narrow phone, large phone/tablet, laptop, and wide desktop.
- Look for horizontal overflow, clipped focus rings, broken grid tracks, awkward title wraps, and inaccessible off-canvas content.
- Confirm that mobile is a deliberate composition, not a compressed desktop.
- Test text zoom and long content where the browser or preview allows it.

## Interaction and accessibility

- Navigate changed controls with keyboard only.
- Confirm visible focus, sensible tab order, semantic names, and non-color-only status.
- Verify hover, focus, pressed, disabled, loading, success, error, and empty states where applicable.
- Check touch target size and pointer cancellation for interactive elements.
- Enable reduced motion and confirm content, orientation, and essential feedback remain available.

## Technical

- Run the project's actual typecheck, lint, tests, build, and preview checks as applicable.
- Check console errors, broken asset requests, font loading, layout shift, and unnecessary network or bundle growth.
- Confirm no temporary debug code, placeholder copy, dead styles, or unreviewed dependency remains.
- Report unavailable checks instead of implying that they passed.

## Polish order

Fix in this order: broken behavior, unreadable or inaccessible content, hierarchy and layout, responsive composition, state feedback, motion, then decorative detail. Stop adding ornament when it no longer improves comprehension.
