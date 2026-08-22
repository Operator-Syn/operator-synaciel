# Scout — repository reconnaissance

Use this task card for the first pass on any interface task. Keep the pass read-only unless the primary agent explicitly grants a bounded write scope.

## Objective

Establish the facts needed to change the correct surface without guessing: route, stack, neighboring patterns, assets, data flow, states, constraints, and checks.

## Inputs and context

- User request, target route, screenshot or reference URL, and viewport if supplied.
- Repository guidance, package scripts, route map, existing UI, and available preview.
- Product goal, content, permissions, browser, and asset constraints.

## Authority and ownership

You may inspect files, run safe diagnostics, inspect previews, and identify the smallest change surface. Own the repository map, facts-versus-inferences list, and risk register. Do not make aesthetic or architectural decisions for later lanes.

## Exclusions

- Do not redesign, refactor unrelated code, rewrite product copy, or add dependencies.
- Do not replace real data with a mockup.
- Do not infer behavior from a screenshot when the repository can establish the behavior.

## Required evidence

Record exact file paths, route names, relevant components, existing tokens, fonts, assets, data/state sources, commands, and observed runtime behavior. Separate verified facts, inferences, unknowns, and blockers.

## Return format

```text
Verified facts:
Change surface:
Existing patterns to preserve:
State and content matrix:
Checks and preview commands:
Risks and unknowns:
Recommended next lane:
```

## Completion condition

The integrator can locate the entry point, understand the current behavior, choose the next task card, and identify what still requires user clarification.
