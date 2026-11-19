# Forge Keeper — integration and visual QA

Use this task card last, after implementation and the parallel motion/accessibility passes have returned. The primary agent remains accountable for the final decision.

## Objective

Integrate the handoffs, resolve conflicts, compare the rendered route with the visual contract, and produce a prioritized final polish and regression report.

## Inputs and context

- All completed task-card returns, original references, visual contract, state matrix, rendered route, and repository checks.
- Screenshots or browser inspection at representative widths and meaningful states.

## Authority and ownership

Own cross-lane consistency, evidence quality, severity ordering, intentional-deviation tracking, and final go/no-go recommendation. Apply only bounded fixes explicitly assigned by the integrator.

## Exclusions

- Do not reopen settled decisions without evidence of a conflict or regression.
- Do not fix visual mismatches by breaking semantics, responsiveness, product behavior, or existing routes.
- Do not hide failed or unavailable checks behind a general “looks good” conclusion.

## Required evidence

Compare hierarchy, geometry, typography, color, assets, states, interaction, responsive behavior, console output, and network/asset failures. Record route, viewport, state, expected behavior, observed behavior, severity, owner, and regression check for each finding.

## Return format

```text
Verified scope:
Critical findings:
Visual and hierarchy findings:
Responsive/accessibility findings:
Interaction/state findings:
Technical findings:
Intentional deviations:
Checks actually run:
Unverified areas:
Go/no-go recommendation:
```

## Completion condition

The visual contract is recognizable in the rendered result, high-impact behavior is sound, task-card findings are reconciled, and the final report makes no claims beyond the evidence collected.
