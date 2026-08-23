---
title: Design System
aliases:
  - Visual system
  - Frontend design system
tags:
  - design-system
  - frontend
role: index
---

# Design System

The public portfolio uses a dark editorial system with cream text, amber
signals, visible rules, and technical metadata. These notes are the canonical
implementation guidance for the four public routes.

## Focused notes

- [[design-system/tokens|Tokens]] - colors, type scale, spacing, shape, focus,
  and motion values.
- [[design-system/typography|Typography]] - Newsreader, IBM Plex Sans, IBM Plex
  Mono, loading, fallbacks, and readable roles.
- [[design-system/tailwind|Tailwind conventions]] - Tailwind v4 setup,
  `@theme`, semantic utilities, and CSS boundaries.
- [[design-system/migration|Migration]] - Bootstrap removal order, route scope,
  API/database invariants, and verification gates.
- [[design-system/references|Visual references]] - checked-in generated images
  for the four route compositions.
- [[design-system/homepage-fidelity|Homepage fidelity]] - the implemented Home
  composition contract, data boundary, and verification targets.
- [[design-system/interaction-patterns|Route interaction patterns]] - the
  shared pointer coordinate rail, inset archive feedback, and future adoption
  rules.
- [[design-system/responsive-layout|Homepage responsive layout]] - the
  responsive reference set, breakpoint audit, addressing rule, and QA plan.

## Impeccable integration

Impeccable `4.1.1` is installed as the repository-local skill under
`.agents/skills/impeccable/`. Its Codex design hook is enabled through
`.codex/hooks.json` and runs the detector after UI edits plus a bounded deep
`Stop` pass.

The shared hook policy lives in `.impeccable/config.json`; the per-developer
consent file is ignored. `PRODUCT.md` now records the confirmed audience,
purpose, positioning, and compatibility constraints. `DESIGN.md` remains
intentionally separate and should be generated with `/impeccable document`
from the incumbent tokens, components, and assets. These files complement this
vault's focused implementation notes and must remain truthful to them.

Use `npx impeccable detect src/` for a deterministic detector pass. Current
baseline findings are documented as follow-up work rather than hidden with
ignore rules.

## Scope

The first pass covers Home, Projects, Certificates, and Snippets. Legal and
hidden application pages keep their existing content behavior and are migrated
after the shared primitives are stable.

The visual migration does not add API fields, routes, D1 tables, or database
migrations. Existing API response shapes remain authoritative.
