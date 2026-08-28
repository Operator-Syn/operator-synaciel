---
title: Tailwind Conventions
aliases:
  - Tailwind CSS
tags:
  - design-system
  - tailwind
role: convention
---

# Tailwind Conventions

This repository uses Tailwind CSS v4 through the Vite plugin. There is no
Sass pipeline and no `tailwind.config.js`; the CSS-first `@theme` block in
`apps/portfolio-web/src/styles/app.css` is the token source.

Tailwind consumes [[design-system/tokens|Design Tokens]] and is indexed with
the other visual contracts in [[design-system/README|Design System]].

## Boundaries

- Use Tailwind utilities for route layout, spacing, typography, state, and
  responsive composition.
- Use semantic classes in `@layer components` for repeated primitives such as
  archive rows, panels, dialogs, and navigation.
- Keep plain CSS for complex Markdown, syntax highlighting, PDF, and media
  behavior. Those rules must consume the shared variables.
- Do not use raw color literals in route components.
- Do not build class names by concatenating arbitrary token fragments; keep
  Tailwind class names statically discoverable.

## Shared primitives

The migration owns a small set of semantic primitives: application shell,
navigation, page frame, archive row, pagination, media dialog, and preview
dialog. These primitives must expose accessible names, visible focus, loading,
empty, error, and reduced-motion behavior.

## Bootstrap boundary

React-Bootstrap and Bootstrap utilities are removed from the four public
routes and shared media/navigation primitives. Legal and hidden pages retain
their content behavior while their shared wrapper styles are converted to the
same tokens.
