---
title: Operator-Syn Documentation Map
aliases:
  - Documentation
  - Docs
tags:
  - index
role: index
---

# Operator-Syn Documentation Map

`docs/` is both the repository's Obsidian vault and its GitHub-readable
documentation. Keep only this map and [[obsidian|vault guidance]] at the vault
root. Topic notes live in focused folders.

## Domain notes

- [[design-system/README|Design system]] - shared visual language, tokens, and
  Tailwind migration conventions.
- [[architecture/overview|Architecture overview]] - runtime boundaries and
  frontend-to-Worker data flow.
- [[architecture/repository-layout|Repository layout]] - source folders and
  their actual responsibilities.
- [[architecture/layer-boundaries|Layer boundaries]] - the current
  fat-model/skinny-controller assessment.
- [[architecture/controllers|Controllers]] - request handling responsibilities
  and thicker boundary exceptions.
- [[architecture/models|Models]] - D1, R2, aggregation, and persistence
  responsibilities.
- [[architecture/portfolio-mcp|Public Portfolio MCP (Streamable HTTP)]] - remote
  read-only agent access, API boundary, and Worker workflow.
- [[architecture/portfolio-agent|Portfolio Assistant Agent]] - bounded,
  authenticated Workers AI chat, MCP grounding, compaction, and quotas.
- [[architecture/portfolio-public-auth|Public Portfolio Authentication]] -
  Google OIDC, Turnstile, sessions, thread ownership, and admin controls.
- [[architecture/portfolio-mcp-modules|Public Portfolio MCP module structure]] -
  internal seams and the refactor convention for the public Worker.
- [[api/routes|API routes]] - public routes, private routes, and auth order.
- [[database/schema|Database schema]] - current D1 tables, relationships, and
  storage references.
- [[database/migrations|Database migrations]] - readable SQL review and apply
  workflow.
- [[database/drizzle|Drizzle tooling]] - typed schema ownership and migration
  generation boundaries.
- [[operations/local-development|Local development]] - install, check, build,
  Graphify, and database commands.
- [[operations/deployment|Production deployment]] - production prerequisites, deployment order, smoke checks, and rollback.
- [[plans/portfolio-agent/implementation-sweeps|Portfolio agent implementation sweeps]] -
  bounded implementation evidence and remaining rollout gates.
- [[operations/repository-mcp|Local Repository MCP (stdio)]] - guarded local
  changes, verification, one-file commits, and versioned Git hooks.

## Vault rules

1. Search this map and existing notes before creating a new note.
2. Update the canonical note instead of duplicating a concept.
3. Split notes when they mix independent concerns or become difficult to scan.
4. Use `[[wikilinks]]` for meaningful vault relationships and normal relative
   Markdown links for GitHub navigation.
5. Treat source code, configuration, and command output as authoritative when
   a note and the repository disagree.
6. Add backlinks for direct source, consumer, or workflow relationships; do not
   link every note to every neighboring note.

Generated Graphify files remain under `graphify-out/` and are not part of this
human-maintained vault.
