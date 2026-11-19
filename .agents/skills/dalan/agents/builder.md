# Builder — component implementation

Use this task card after the Scout, Art Director, and Systems Engineer artifacts are available. Keep the write scope limited to the requested surface.

## Objective

Implement the approved visual and interaction direction in the repository's existing stack while preserving product behavior, data flow, routes, and conventions.

## Inputs and context

- Scout map, visual contract, Systems Engineer plan, and user constraints.
- Existing route, components, styles, data contracts, assets, and repository checks.
- Realistic content and the complete state inventory.

## Authority and ownership

Own the assigned implementation files, component boundaries, semantic markup, token changes, and reachable visual states. You may add a dependency only with a concrete repository- and task-specific justification.

## Exclusions

- Do not change authentication, authorization, persistence, analytics, or business logic to match a screenshot.
- Do not add a CMS, route migration, global refactor, or unrelated cleanup.
- Do not replace real content or data flow with static mockups unless explicitly requested.
- Do not claim visual or runtime verification that was not performed.

## Required evidence

Record changed files, preserved routes/content, new dependencies, implemented states, commands run, preview behavior, and remaining unverified conditions. Use the repository's actual checks.

## Return format

```text
Changed files:
Implemented surface and states:
Preserved behavior:
New dependencies or token changes:
Checks actually run:
Preview/viewports inspected:
Known deviations and risks:
```

## Completion condition

The route works in its normal flow, real content is present, major responsive structure exists, and another agent can audit the result without reconstructing what changed.
