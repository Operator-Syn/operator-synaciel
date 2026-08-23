---
title: Portfolio Visual References
aliases:
  - Revamp references
  - Dalan references
tags:
  - design-system
  - visual-reference
role: reference
---

# Portfolio Visual References

These generated PNGs are the visual reference set for the current revamp. They
are stored in the vault so later implementation and visual QA can compare the
rendered routes against the agreed composition without relying on chat history
or an external image location.

## Routes

### Home

![Home portfolio reference](references/portfolio-home.png)

Identity leads the page, followed by the profile note, tool loadout, profile
metadata, links, and the archive entry point.

### Projects

![Projects archive reference](references/portfolio-projects.png)

Projects use an indexed media archive. The visible content comes from the
existing project and gallery responses; the numbered rows and amber actions are
presentation only.

### Certificates

![Certificates archive reference](references/portfolio-certificates.png)

Certificates use the same archive grammar while emphasizing credential media,
descriptions, credential links, and existing pagination.

### Snippets

![Snippets archive reference](references/portfolio-snippets.png)

Snippets use a technical file-index grammar with path, modified time, size,
folder navigation, and a Markdown/PDF preview state.

## Evidence boundary

The images are design references, not screenshots of a new implementation and
not API fixtures. Generated labels such as section indexes, visual type labels,
and decorative coordinates must not become new database fields unless a later
product requirement explicitly adds them.

The implementation remains bound to [[api/routes|the current API routes]],
[[database/schema|the current D1 schema]], and [[design-system/tokens|the shared
tokens]].
