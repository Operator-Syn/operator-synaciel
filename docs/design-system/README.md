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

The default public portfolio uses a dark editorial system with cream text, amber
signals, visible rules, and technical metadata. Built-in alternate palettes
remap the same semantic roles without changing the composition. These notes are
the canonical implementation guidance for the four public routes and the linked
legal/application surfaces.

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
  for the core routes plus documented hidden-application references.
- [[design-system/social-previews|Social preview cards]] - the generated
  1200x630 link-unfurl composition, route metadata boundary, and QA contract.
- [[design-system/homepage-fidelity|Homepage fidelity]] - the implemented Home
  composition contract, data boundary, and verification targets.
- [[design-system/certificates-fidelity|Certificates fidelity]] - the
  credential archive composition, interaction contract, responsive thresholds,
  and verification targets.
- [[design-system/snippets-fidelity|Snippets fidelity]] - the file-index and
  persistent preview composition, interaction contract, and API boundary.
- [[design-system/interaction-patterns|Route interaction patterns]] - the
  shared pointer coordinate rail, inset archive feedback, and future adoption
  rules.
- [[design-system/responsive-layout|Homepage responsive layout]] - the
  responsive reference set, breakpoint audit, addressing rule, and QA plan.

## Impeccable integration

The bundled Impeccable skill lives under `.agents/skills/impeccable/`.
Its [Codex hook configuration](../../.codex/hooks.json) runs the detector
on UI edits and reports findings at `Stop`. The shared hook policy lives in
[`.impeccable/config.json`](../../.impeccable/config.json); per-developer
consent remains local.

Impeccable discovers [product context](../PRODUCT.md) and
[design context](../DESIGN.md) directly under `docs/`. The product guide
records audience, purpose, and constraints; the design spec carries shared
visual rules and machine-readable tokens. Update these canonical files rather
than generating duplicate copies in the repository root.

Use `npx impeccable detect apps/portfolio-web/src/` for a deterministic detector pass. Current
baseline findings are documented as follow-up work rather than hidden with
ignore rules.

## Scope

The current pass covers Home, Projects, Certificates, Snippets, legal pages,
and the hidden NetBird and Atelier application surfaces. Each route keeps its
existing content behavior and data boundaries while adopting the shared visual
system.

The visual migration does not add API fields, routes, D1 tables, or database
migrations. Existing API response shapes remain authoritative.
