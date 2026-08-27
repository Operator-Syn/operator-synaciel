# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

An existing React and TypeScript frontend built with Vite, backed by a Hono
Cloudflare Worker API with D1, R2, and a separate auth Worker. Existing routes,
API response shapes, and storage boundaries are authoritative.

## Users

Visitors may come from any field. The important audiences are recruiters,
potential collaborators, and people considering the owner's software
development services.

## Product Purpose

The site is a semi-portfolio and blog that presents projects, certificates,
technical snippets, and periodic learnings from programming and software
development concepts. It should help a visitor understand the owner's work,
thinking, and capability without requiring a live sales conversation first.

## Positioning

It is a living, service-facing technical portfolio and learning journal:
project evidence and practical software-development notes evolve together
instead of presenting a static list of skills.

## Operating Context

- Visitors browse public portfolio, project, certificate, and snippet surfaces.
- The owner updates the site periodically with new work and learnings rather
  than publishing on a fixed editorial schedule.
- The public frontend consumes the existing API and media storage flows.
- The portfolio may be evaluated quickly by someone unfamiliar with the owner,
  so the first view must establish identity, capability, and a clear path into
  evidence.

## Capabilities and Constraints

- Preserve the existing public and legal routes, real project content, media,
  and snippet behavior.
- Preserve API compatibility, current response shapes, D1 schema, R2 flows,
  authentication boundaries, and readable migration history.
- Do not invent testimonials, clients, metrics, project outcomes, or other
  commercial claims that are not supported by repository content.
- Keep content and visual improvements compatible with the current React/Vite
  and Cloudflare architecture.
- Treat the focused Obsidian notes under `docs/` as the durable project map;
  update canonical notes instead of duplicating them.

## Brand Commitments

The current visual direction is a dark editorial system with cream text, amber
signals, visible rules, technical metadata, and restrained surfaces. The
documented type roles are Newsreader for display, IBM Plex Sans for body and
controls, and IBM Plex Mono for technical metadata. The shared tokens and
checked-in route references in `docs/design-system/` are the visual evidence to
preserve and refine.

## Evidence on Hand

- `docs/design-system/tokens.md` - shared colors, type roles, spacing, shape,
  focus, and motion rules.
- `docs/design-system/typography.md` - font roles and fallback behavior.
- `docs/design-system/references.md` - checked-in Home, Projects, Certificates,
  and Snippets reference images.
- `docs/api/routes.md` - current public/private API contract.
- `docs/database/schema.md` - current D1 schema and relationships.
- The source routes and models provide the actual content and data behavior.

No external testimonials, benchmark claims, or customer proof are established
by this product record; future work must not fabricate them.

## Product Principles

1. Show evidence before making claims.
2. Let the portfolio evolve as the owner's learning and work evolve.
3. Make the artifact and technical substance lead while keeping navigation easy
   for visitors with different levels of software expertise.
4. Improve presentation without breaking API, database, route, or storage
   contracts.

## Accessibility & Inclusion

The product is responsive public web content for visitors with varied technical
backgrounds. Preserve readable contrast, keyboard and focus behavior, usable
touch targets, responsive layouts, and clear language while refining the visual
system.
