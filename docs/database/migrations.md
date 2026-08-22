---
title: D1 Migrations
tags:
  - database
  - d1
  - operations
role: guide
---

# D1 Migrations

Top-level SQL files in `migrations/` contain future schema changes for the
`my-personal-portfolio` D1 database. The current database predates this
workflow. Keep [`src/data/Database-Schema.sql`](../../src/data/Database-Schema.sql)
as the existing schema reference and
[`src/data/Initial-Seed.sql`](../../src/data/Initial-Seed.sql) as bootstrap
content. Do not replay the seed through migration history.

## File rules

- Use one readable SQL file per logical schema change.
- Use Wrangler's numeric names, such as `0001_add_project_slug.sql`.
- Never edit a migration after it has been applied anywhere.
- Do not use generated, minified, or placeholder SQL.
- The first real schema change becomes migration `0001`.

Start each migration with a review header:

```sql
-- Purpose: Add a stable public slug to projects.
-- Affected tables: Projects.
-- Data impact: Schema change only; existing rows remain valid.
-- Compatibility: The column is nullable until data is backfilled.
-- Rollback: Remove the column with a reviewed forward-fix if necessary.
```

## Review workflow

Create a migration without applying it:

```bash
npm run db:migration:create -- add_descriptive_change
```

Read the SQL and inspect the exact diff:

```bash
git diff -- migrations/ wrangler.toml package.json
```

List and apply pending migrations locally first:

```bash
npm run db:migrations:list:local
npm run db:migrations:apply:local
```

After local schema and application checks pass, inspect the remote pending
list:

```bash
npm run db:migrations:list:remote
```

Remote application is an explicit final step and is never part of a Worker
deploy command:

```bash
npm run db:migrations:apply:remote
```

Do not run the remote command without reviewing the SQL and pending list.
