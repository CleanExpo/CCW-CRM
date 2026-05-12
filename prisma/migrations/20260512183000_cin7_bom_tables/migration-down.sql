-- RA-3030 — companion down migration for 20260512183000_cin7_bom_tables.
--
-- Prisma does NOT auto-run *-down.sql files (Prisma migrations are
-- forward-only). This file exists to document the rollback path so an
-- operator does not have to hand-write DROP TABLE statements in
-- production during an incident.
--
-- Drop order matches FK dependency order:
--   1. cin7_production_runs  (FKs cin7_bom_masters)
--   2. cin7_bom_components   (FKs cin7_bom_masters; CASCADE on parent drop)
--   3. cin7_bom_masters      (root)
--
-- ⚠️  Running this DROPS ALL DATA in the 3 tables. Take a Supabase
-- backup snapshot first. See docs/runbooks/cin7-bom-rollback.md for
-- the full operator procedure.

BEGIN;

DROP TABLE IF EXISTS "cin7_production_runs" CASCADE;
DROP TABLE IF EXISTS "cin7_bom_components"  CASCADE;
DROP TABLE IF EXISTS "cin7_bom_masters"     CASCADE;

-- Manually remove from Prisma's migration history so a future
-- `prisma migrate deploy` will re-apply the forward migration:
--
--   DELETE FROM "_prisma_migrations"
--    WHERE migration_name = '20260512183000_cin7_bom_tables';

COMMIT;
