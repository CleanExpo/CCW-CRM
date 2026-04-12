# ADR-003: Supabase Migration Conventions

**Date**: 2026-03-31
**Status**: Accepted

## Context

The project uses Supabase Cloud for PostgreSQL. Migrations are tracked in `supabase/migrations/` and applied via the Supabase MCP or `supabase db push`.

## Decisions

1. **Timestamp format**: `YYYYMMDDHHMMSS_description.sql` (24-hour, UTC)
2. **Idempotency**: All migrations must use `IF NOT EXISTS` / `IF EXISTS` guards
3. **No CONCURRENTLY**: Supabase MCP wraps migrations in transactions — `CREATE INDEX CONCURRENTLY` will fail
4. **RLS required**: Every new table with user data must have `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
5. **Never modify applied migrations**: Only forward migrations. Use a new migration to fix issues.
6. **Local + remote sync**: Every migration applied via MCP must also exist as a local `.sql` file

## Template

```sql
-- =============================================================================
-- Migration: Description (UNI-XXXX)
-- Applied: YYYY-MM-DD
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.example (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
```
