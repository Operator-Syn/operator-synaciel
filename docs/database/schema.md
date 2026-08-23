---
title: Database Schema
tags:
  - database
  - d1
role: concept
---

# Database Schema

The canonical editable schema is [`src/db/schema.ts`](../../src/db/schema.ts).
It describes the SQLite/D1 tables, indexes, foreign keys, defaults, and check
constraints used by the Worker. Drizzle generates the SQL migration files;
Wrangler applies them.

## Tables

- `site_settings` stores keyed global values.
- `profile_info` stores ordered label/value profile entries.
- `sections` stores ordered dynamic content groups.
- `section_items` stores ordered section content and cascades when its section
  is deleted.
- `Projects` stores portfolio projects and their main media URL.
- `GalleryItems` stores ordered media belonging to a project and cascades with
  that project.
- `Certificates` stores certificate entries and their main media URL.
- `CertificateItems` stores ordered certificate media and cascades with its
  certificate.
- `Snippets` stores a recursive directory/file tree. File entries reference an
  R2 `storage_path`; directory entries have no `file_format`.

The schema indexes section and gallery foreign keys, project display-order
lookups, certificate ownership, and snippet parent/order lookups. The project
display-order/index pair provides the stable keyset boundary used by the
cursor-backed archive. `Snippets` restricts file formats to `pdf` or `md` when
the entry is a file.

## Migration baseline

[`migrations/0000_baseline.sql`](../../migrations/0000_baseline.sql) records the
schema that already exists in D1. Its DDL is idempotent and is not a data
reset. Future schema changes must update the Drizzle schema and generate a new
migration.

## Data references

[`src/data/Initial-Seed.sql`](../../src/data/Initial-Seed.sql) is bootstrap and
mutable portfolio content. It is not a historical migration and must not be
replayed through the D1 migration table. The full workflow is documented in
[[database/migrations|D1 migrations]] and [[database/drizzle|Drizzle tooling]].
