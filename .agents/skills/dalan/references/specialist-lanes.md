# Specialist lanes

Use this file as the orchestration map. The detailed task contracts live in `../agents/`; load the relevant card before delegating. Every lane has a disjoint responsibility and must return a small artifact for the integrator.

| Lane | Task card | Owns |
|---|---|---|
| Scout | [`../agents/scout.md`](../agents/scout.md) | Repository facts, route map, constraints, and risks |
| Art Director | [`../agents/art-director.md`](../agents/art-director.md) | Visual contract and reference translation |
| Systems Engineer | [`../agents/systems-engineer.md`](../agents/systems-engineer.md) | Layout, type, tokens, responsive rules, and states |
| Builder | [`../agents/builder.md`](../agents/builder.md) | Production implementation in the assigned surface |
| Motion Editor | [`../agents/motion-editor.md`](../agents/motion-editor.md) | Interaction states and purposeful motion |
| Access and Adaptation Auditor | [`../agents/accessibility-auditor.md`](../agents/accessibility-auditor.md) | Responsive and accessibility findings |
| Forge Keeper | [`../agents/forge-keeper.md`](../agents/forge-keeper.md) | Integration, regression risk, and visual QA |

## 1. Scout — reconnaissance

**Input:** repository, target route, screenshot or reference URL, user constraints.

**Produce:** stack and route map, relevant files, existing tokens/components, available checks, asset constraints, and risks. Do not redesign or edit unrelated files.

**Handoff:** point to exact files and commands; distinguish observed facts from assumptions.

**Stop when:** the integrator can locate the change surface without guessing.

## 2. Art Director — visual translation

**Input:** target references and Scout's constraints.

**Produce:** visual contract with three to five traits, hierarchy, palette roles, type contrast, grid/alignment logic, graphic motif, motion posture, and explicit exclusions.

**Handoff:** describe principles and tokens, not copied markup or a moodboard dump.

**Stop when:** another agent can make consistent visual decisions without reopening every reference.

## 3. Systems Engineer — layout and type

**Input:** visual contract, content inventory, supported breakpoints.

**Produce:** token table, page/section map, responsive transformations, type roles, and component/state inventory.

**Handoff:** identify which values are global, component-level, or one-off and why.

**Stop when:** the Builder can implement the shell and key states without inventing layout rules.

## 4. Builder — component implementation

**Input:** Scout map, visual contract, Systems Engineer artifact.

**Produce:** working UI in the repository's existing stack, using real content and semantic structure.

**Handoff:** list changed files, new dependencies, assumptions, and unverified states. Keep the write scope to the requested surface.

**Stop when:** the route works in its normal state and the major responsive structure is present.

## 5. Motion Editor — interaction

**Input:** static implementation, interaction requirements, reduced-motion constraint.

**Produce:** state map and the smallest set of transitions needed for hierarchy, feedback, and orientation.

**Handoff:** document triggers, properties, durations/easing, cleanup, focus behavior, and reduced-motion fallback.

**Stop when:** motion improves comprehension and can be disabled without losing content or control.

## 6. Access and Adaptation Auditor — responsive/accessibility

**Input:** implementation and target viewport range.

**Produce:** findings for keyboard flow, focus, contrast, semantics, reduced motion, text zoom, touch targets, overflow, wrapping, and mobile composition.

**Handoff:** rank issues by user impact and give exact reproduction conditions.

**Stop when:** no high-impact issue remains unexplained; fixes can be handed to the Builder or Integrator.

## 7. Forge Keeper — visual QA and integration

**Input:** all prior artifacts, rendered route, repository checks.

**Produce:** prioritized polish pass covering hierarchy, alignment, spacing, contrast, density, content fidelity, state completeness, and regression risk.

**Handoff:** attach evidence: viewport/state, expected behavior, observed behavior, and smallest safe fix.

**Stop when:** the visual contract is recognizable in the rendered result and all claimed checks have actually run.

## Parallelization rule

Scout should run first. Art Director and Systems Engineer may proceed in parallel once the Scout map exists. Builder follows both. Motion Editor and Access and Adaptation Auditor can run in parallel after the static route exists. Forge Keeper integrates only after those findings return. Avoid overlapping edits; give one agent ownership of each file or keep analysis lanes read-only.
