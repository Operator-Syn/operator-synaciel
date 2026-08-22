---
title: Database Schema
tags:
  - database
  - d1
role: concept
---

# Database Schema

The current schema reference is [`src/data/Database-Schema.sql`](../../src/data/Database-Schema.sql).
It uses SQLite/D1 SQL and creates tables and indexes idempotently.

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

The schema indexes section and gallery foreign keys, certificate ownership,
and snippet parent/order lookups. `Snippets` restricts file formats to `pdf` or
`md` when the entry is a file.

## Data references

[`src/data/Initial-Seed.sql`](../../src/data/Initial-Seed.sql) is bootstrap and
mutable portfolio content. It is not a historical migration and must not be
replayed through the D1 migration table. Future schema changes follow
[[database/migrations|the migration workflow]].
