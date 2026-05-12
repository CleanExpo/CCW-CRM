# Cin7 BOM Rollback Runbook — RA-3030

Procedure for rolling back the Cin7 BOM schema introduced by migration
`20260512183000_cin7_bom_tables` (commit `1d208774`).

> ⚠️ **This DROPS ALL DATA in the 3 cin7 tables.** Take a Supabase
> point-in-time backup snapshot before running anything in this
> document. If you don't know how, stop and ask Phill.

## When to run this

- The BOM feature is being deprecated.
- Production schema drift has rendered the tables unrecoverable.
- A failed partial migration has left the schema in a state Prisma
  cannot reconcile (errors like `relation "cin7_bom_components"
  already exists` on `prisma migrate deploy`).

This is **not** the right procedure for:
- A code-level bug — fix the bug forward, don't roll back the schema.
- "I want to reset the data" — `TRUNCATE` the tables instead.

## Pre-flight (5 min)

1. Confirm a Supabase point-in-time backup exists within the last hour:
   Supabase Dashboard → Project Settings → Database → Backups.
2. Notify CCW (Toby) in advance — losing the BOM tables disables the
   Production Runs feature in his workspace.
3. Apply maintenance mode if rollback requires the app to be quiescent:
   ```bash
   railway variables --set MAINTENANCE_MODE=true
   railway redeploy
   ```

## Procedure (10 min)

### 1. Run the down migration

The down-migration SQL lives at
`prisma/migrations/20260512183000_cin7_bom_tables/migration-down.sql`.
Prisma does NOT auto-run this file; apply it manually:

```bash
psql "$DATABASE_URL" \
  -f prisma/migrations/20260512183000_cin7_bom_tables/migration-down.sql
```

This:
- Drops `cin7_production_runs`, `cin7_bom_components`,
  `cin7_bom_masters` (in FK-dependency order) within a transaction.

### 2. Remove the migration from Prisma's history

So a future `prisma migrate deploy` doesn't think the migration is
already applied:

```bash
psql "$DATABASE_URL" <<EOF
DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260512183000_cin7_bom_tables';
EOF
```

If you also need to undo the companion RLS migration (RA-3029):

```bash
psql "$DATABASE_URL" <<EOF
DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260513000000_cin7_bom_rls';
EOF
```

(The RLS migration's policies are dropped automatically when the
tables go via `CASCADE` — no separate down step needed.)

### 3. Disable the maintenance flag

```bash
railway variables --set MAINTENANCE_MODE=false
railway redeploy
```

### 4. Verify

```sql
-- All three tables gone:
SELECT tablename FROM pg_tables
 WHERE schemaname = 'public' AND tablename LIKE 'cin7_%';
-- (expect 0 rows)

-- Prisma history clean:
SELECT migration_name FROM "_prisma_migrations"
 WHERE migration_name LIKE '%cin7_bom%';
-- (expect 0 rows)
```

## Post-rollback

- Tell Toby it's done.
- File a Linear ticket capturing the reason for the rollback so the
  decision is recoverable later.
- If the forward migration needs to be re-applied later, re-run
  `pnpm prisma migrate deploy` — both `20260512183000_cin7_bom_tables`
  and `20260513000000_cin7_bom_rls` will re-apply in order.

## Why this isn't auto-runnable

Prisma's migration model is forward-only by design. Adding an
auto-down feature would couple the deploy pipeline to a destructive
path that should always be human-gated for production data.
