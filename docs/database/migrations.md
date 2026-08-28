---
title: D1 Migrations
tags:
  - database
  - d1
  - operations
role: guide
---

# D1 Migrations

Drizzle Kit generates the readable SQL files in
`workers/portfolio-api/migrations/` from
[`workers/portfolio-api/src/db/schema.ts`](../../workers/portfolio-api/src/db/schema.ts). Wrangler applies those files to
the `my-personal-portfolio` D1 database and records them in `d1_migrations`.
See [[database/drizzle|Drizzle tooling]] for schema ownership and command
roles.

The existing database predates this workflow. `0000_baseline.sql` is an
idempotent schema baseline;
[`workers/portfolio-api/src/data/Initial-Seed.sql`](../../workers/portfolio-api/src/data/Initial-Seed.sql)
remains bootstrap content and must not be replayed through migration history.

The project archive cursor rollout uses two forward migrations: `0001` first
normalizes legacy `Projects.display_order` NULLs to the existing `0` default,
then `0002` adds `idx_projects_display_order_id` for the stable
`display_order, id` keyset order. Neither migration changes project content or
the baseline file.

The certificate archive cursor rollout follows the same two-step pattern: `0003`
normalizes legacy `Certificates.display_order` NULLs to `0`, then `0004` adds
`idx_certificates_display_order_id` for the stable `display_order, id` keyset
order. Both are forward-compatible with the unversioned certificate routes;
they do not rewrite certificate content or the baseline file.

Migration `0005` normalizes surrounding ASCII whitespace in persisted
`section_items.image_url` and `section_items.target_url` values. The API model
also trims those URL fields before future creates and updates, so public web and
portfolio MCP readers receive the same canonical stored values.

## File rules

- Generate one readable SQL file per logical schema change with Drizzle.
- Keep Drizzle's numeric names, such as `0001_add_project_slug.sql`.
- Never edit a migration after it has been applied anywhere.
- Do not manually create a migration with `wrangler d1 migrations create`.
- Do not edit files under `workers/portfolio-api/migrations/meta/` by hand.

Start each migration with a review header:

```sql
-- Purpose: Add a stable public slug to projects.
-- Affected tables: Projects.
-- Data impact: Schema change only; existing rows remain valid.
-- Compatibility: The column is nullable until data is backfilled.
-- Rollback: Remove the column with a reviewed forward-fix if necessary.
```

## Review workflow

Generate a migration without applying it:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
```

Read the SQL and inspect the exact diff:

```bash
git diff -- workers/portfolio-api/src/db/schema.ts workers/portfolio-api/migrations/ workers/portfolio-api/drizzle.config.ts workers/portfolio-api/wrangler.toml package.json
```

List and apply pending migrations locally first:

```bash
npm run db:migrations:list:local
npm run db:migrations:apply:local
```

After local schema and application checks pass, inspect the remote pending
list. Listing is read-only; application is a separate authorized operation:

```bash
npm run db:migrations:list:remote
```

Remote application is an explicit final step and is never part of a Worker
deploy command:

```bash
npm run db:migrations:apply:remote
```

Do not run the remote command without reviewing the SQL, local result, and
remote pending list. A Worker deploy never applies migrations.
