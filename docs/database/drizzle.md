---
title: Drizzle Migration Tooling
tags:
  - database
  - d1
  - drizzle
role: guide
---

# Drizzle Migration Tooling

Drizzle owns the typed schema and SQL generation workflow. Runtime models still
use parameterized `D1Database.prepare()` calls; this phase does not change API
queries or response shapes.

## Sources of truth

- [`src/db/schema.ts`](../../src/db/schema.ts) is the editable schema.
- `migrations/*.sql` contains reviewed SQL generated from that schema.
- `migrations/meta/` contains Drizzle's schema snapshots and journal.
- [`wrangler.toml`](../../wrangler.toml) defines the D1 migration directory.
- `src/data/Initial-Seed.sql` remains bootstrap content, not migration history.

Drizzle Kit 0.31 emits flat, numbered SQL files. Do not move them into nested
directories or add a custom Wrangler migration pattern; the default D1
discovery matches this output.

## Workflow

Change the schema first, then generate a named migration:

```bash
npm run db:migration:generate -- --name=add_descriptive_change
npm run db:migration:check
git diff -- src/db/schema.ts migrations/ drizzle.config.ts wrangler.toml package.json
```

Use a custom migration only for reviewed SQL that cannot be represented in the
schema declaration, such as a controlled data backfill:

```bash
npm run db:migration:custom -- --name=backfill_descriptive_change
```

Wrangler, not `drizzle-kit migrate`, applies the SQL so Cloudflare's
`d1_migrations` ledger remains authoritative:

```bash
npm run db:migrations:list:local
npm run db:migrations:apply:local
npm run db:migrations:list:remote
npm run db:migrations:apply:remote
```

The remote command requires explicit review and authorization. A Worker deploy
does not apply database migrations.

## Baseline

`0000_baseline.sql` records the schema that already exists in D1. Its table and
index DDL is idempotent so the first application can establish migration
history without replacing existing data. Never replay `Initial-Seed.sql` as
part of the baseline.

After a migration is applied anywhere, treat its SQL and Drizzle metadata as
immutable. Use a new forward migration for corrections or rollback behavior.
