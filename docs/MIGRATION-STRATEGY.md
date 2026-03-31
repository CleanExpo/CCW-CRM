# CCW Database Migration Strategy (UNI-1737)

**Last updated**: 2026-03-31
**Database**: Supabase Cloud (vwfgksqkajnpfjospbpe), PostgreSQL 15

---

## Migration Infrastructure

All migrations live in `supabase/migrations/` with timestamp-prefixed filenames.

Applied migrations to date:
- `20260331180001` — Fix agent_run_summaries security_invoker view
- `20260331190001` — RLS on 9 sensitive credential tables
- `20260331190002` — Fix mutable search_path on 10 functions
- `20260331190003` — Enable RLS on public.users (deny-all for PostgREST)
- `20260331200001` — Performance indexes on order_activity + order_items FK
- `20260331200002` — AU Privacy Act compliance tables (4 tables)

---

## How to Write a Migration

### 1. Create the file
```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

### 2. Use the standard header
```sql
-- =============================================================================
-- Migration: Description (UNI-XXXX)
-- Description: What this does and why
-- Applied: YYYY-MM-DD
-- =============================================================================
```

### 3. Idempotency rules (MANDATORY)
- Tables: `CREATE TABLE IF NOT EXISTS`
- Indexes: `CREATE INDEX IF NOT EXISTS`
- Columns: `ALTER TABLE x ADD COLUMN IF NOT EXISTS`
- Never: `CREATE TABLE` without IF NOT EXISTS
- Never: `DROP TABLE` (use soft deletes or archive strategies)

### 4. RLS requirement
Every new table with user data must have:
```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
```

### 5. Supabase MCP limitations
- No `CREATE INDEX CONCURRENTLY` (transactions don't support it)
- No `ALTER SYSTEM` commands
- Migrations run as postgres superuser

---

## How to Apply a Migration

```bash
# Via Supabase MCP (production)
# Uses mcp__c879c796-40a3-4892-8e02-fbb874e287ab__apply_migration

# Via CLI (local dev)
supabase db push

# Verify applied
supabase migration list
```

---

## Migration Safety Rules

1. Never modify an already-applied migration file
2. New file = new timestamp, always
3. If a migration fails, fix the issue and create a NEW migration — don't edit the failed one
4. Test destructive migrations on a branch database first
5. Large data migrations should use batched updates (avoid table locks)

---

## Core Tables (Protected — no migration without CEO approval)

- `public.users` — core auth table
- `public.organizations` — org data
- `public.products` — product catalog
- `public.customers` — customer data
- `public.orders` / `public.order_items` — order data
- `public.quotes` / `public.quote_items` — quote data

Defined in `apps/backend/src/db/demo_models.py` — **DO NOT MODIFY**.
