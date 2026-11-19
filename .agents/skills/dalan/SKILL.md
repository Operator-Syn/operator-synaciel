---
name: dalan
description: Build and refine production web interfaces from visual references using a dark editorial, typographic, grid-led, technical design language with warm accents, responsive behavior, accessible interactions, restrained motion, and visual QA. Use when creating or revamping portfolios, landing pages, dashboards, product surfaces, or any interface that needs a distinctive visual system instead of generic UI.
---

# Dalan

Use this skill as a design-and-implementation operating system, not as a fixed template. Translate the requested reference into a coherent visual system, preserve the repository's existing architecture, and implement only the degree of art direction the product can support.

## Operating loop

1. **Reconnaissance.** Inspect the repository, route, framework, existing components, tokens, assets, responsive behavior, and verification commands before editing. Read the smallest relevant project guidance first.
2. **Visual contract.** Write down the surface, audience, primary action, three to five visual traits, content hierarchy, contrast strategy, and the single graphic motif that gives the page its identity. Use `references/visual-language.md` and `references/surface-adaptations.md` when the request is based on the Dalan direction or a screenshot.
3. **Route the work.** Select the smallest useful set of task cards under `agents/`, using `references/specialist-lanes.md` for order and parallelization. Delegate disjoint cards when subagents are available; otherwise execute them sequentially and keep one integrator responsible for consistency.
4. **Forge the system.** Establish type roles, spacing, color tokens, grid behavior, borders, surfaces, and responsive rules before polishing individual components. Read `references/layout-and-type.md`.
5. **Build in passes.** Implement the structural shell first, then real content, then component states, then motion and decorative detail. Keep the semantic HTML and data flow intact. Read `references/implementation.md` for repository-aware guidance.
6. **Verify and refine.** Test representative viewport sizes, keyboard and reduced-motion behavior, content overflow, loading/error/empty states, and the project's own checks. Use `references/motion-and-interaction.md` and `references/qa.md`.

## Reference routing

- Need to interpret a screenshot or live site: read `references/reference-index.md` and `references/visual-language.md`.
- Need to adapt the direction to a portfolio, landing page, dashboard, or product surface: read `references/surface-adaptations.md`.
- Need more examples: read only the relevant group in `references/inspiration-sources.md`; use galleries as search surfaces, not as code to copy.
- Need composition, type, palette, or responsive rules: read `references/layout-and-type.md`.
- Need hover, scroll, transition, or state behavior: read `references/motion-and-interaction.md`.
- Need to change an existing codebase: read `references/implementation.md`.
- Need to split work or define handoffs: read `references/specialist-lanes.md`, then load only the relevant task card under `agents/`.
- Need a final audit: read `references/qa.md`.

## Guardrails

- Preserve the project's established stack, routing, data model, and visual conventions unless the user explicitly asks for a migration.
- Treat references as evidence of principles. Do not reproduce another site's copy, proprietary assets, exact composition, or interaction gimmicks.
- Prefer hierarchy, typography, whitespace, rules, and one controlled motif over a pile of decorative effects.
- Make the interface feel intentional before adding animation. Never use motion to conceal weak hierarchy or slow the primary task.
- Use real content early. Placeholder content often hides wrapping, density, and hierarchy problems.
- Make every important action and state understandable without color, hover, animation, or a pointer device.
- Avoid introducing a dependency for a visual effect that CSS, inline SVG, or the existing stack can express safely.
- Keep the design identity portable: a portfolio, landing page, dashboard, and product surface may share grammar without sharing markup.

## Handoff contract

Before implementation, record:

- visual contract and the chosen reference principles;
- page or route map and content hierarchy;
- token decisions and responsive breakpoints;
- component/state inventory;
- known constraints and unresolved questions.

After implementation, report changed files, verified states and viewport sizes, checks actually run, and any visual or content assumptions that remain.

## Agent task cards

The files under `agents/` are executable task contracts, not general reference notes. Pass the relevant card to a delegated agent with the task-local context. Do not invoke every card by default.

- `agents/scout.md` — establish repository and product facts;
- `agents/art-director.md` — translate references into a visual contract;
- `agents/systems-engineer.md` — define layout, type, tokens, and states;
- `agents/builder.md` — implement the approved surface;
- `agents/motion-editor.md` — implement purposeful interaction and motion;
- `agents/accessibility-auditor.md` — audit responsive and accessible behavior;
- `agents/forge-keeper.md` — integrate findings and perform final visual QA.

Every card requires a structured return. The primary agent remains accountable for synthesis, conflicting decisions, and final verification.

## Failure modes to correct

- Generic cards, pills, gradients, or shadows replacing a real visual system.
- Oversized type that destroys reading order or wraps unpredictably on narrow screens.
- Decorative grids, diagrams, or labels that compete with the primary action.
- Motion that causes layout shift, traps focus, ignores reduced motion, or makes content harder to scan.
- A desktop composition squeezed onto mobile instead of being deliberately re-composed.
- A polished hero followed by unfinished states, inaccessible controls, or unverified overflow.
