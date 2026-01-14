# Database AGENTS.md

> Supabase (PostgreSQL + pgvector + RLS) database configuration

## Package Identity

| Attribute | Value |
|-----------|-------|
| Database | PostgreSQL 15 |
| Platform | Supabase |
| Extensions | pgvector, uuid-ossp |
| Security | Row Level Security (RLS) |

## Setup & Run

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Apply migrations to local
supabase db push

# Reset database (drops all data!)
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > ../apps/web/types/database.ts

# Create new migration
supabase migration new <migration_name>
```

## File Organization

```
supabase/
├── config.toml           # Supabase configuration
├── seed.sql              # Seed data for development
└── migrations/           # Database migrations (ordered)
    ├── 00000000000000_init.sql
    ├── 00000000000001_auth_schema.sql
    ├── 00000000000002_enable_pgvector.sql
    ├── 00000000000003_state_tables.sql
    └── ...
```

## Migration Conventions

### ✅ DO: Migration Structure

```sql
-- migrations/00000000000004_example.sql

-- =============================================================================
-- Migration: Example Feature
-- Description: What this migration does
-- =============================================================================

-- Create table
create table if not exists public.example (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    data jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.example enable row level security;

-- RLS Policies
create policy "Users can view own data"
    on public.example for select
    using (auth.uid() = user_id);

create policy "Users can insert own data"
    on public.example for insert
    with check (auth.uid() = user_id);

create policy "Users can update own data"
    on public.example for update
    using (auth.uid() = user_id);

-- Indexes
create index if not exists example_user_id_idx on public.example(user_id);
create index if not exists example_created_at_idx on public.example(created_at desc);

-- Updated at trigger
create trigger example_updated_at
    before update on public.example
    for each row execute function public.handle_updated_at();
```

### ❌ DON'T: Anti-patterns

```sql
-- BAD: No RLS on user data
create table public.secrets (
    id uuid primary key,
    secret_value text  -- NO RLS = anyone can read!
);

-- BAD: Missing foreign key constraint
create table public.posts (
    user_id uuid  -- Should reference auth.users(id)
);

-- BAD: No indexes on frequently queried columns
create table public.logs (
    created_at timestamptz  -- Missing index!
);

-- BAD: Using serial instead of uuid
create table public.items (
    id serial primary key  -- Use uuid for distributed systems
);
```

## Key Tables

| Table | Purpose | Migration |
|-------|---------|-----------|
| `auth.users` | Supabase Auth users | Built-in |
| `public.profiles` | User profiles | `00000000000001_auth_schema.sql` |
| `public.agent_state` | Agent execution state | `00000000000003_state_tables.sql` |
| `public.audit_evidence` | Verification evidence | `00000000000004_audit_evidence.sql` |

## RLS Patterns

### User-Owned Data
```sql
-- Users can only access their own data
create policy "Users own data"
    on public.user_data for all
    using (auth.uid() = user_id);
```

### Service Role Bypass
```sql
-- Service role can access everything (for backend)
create policy "Service role access"
    on public.admin_data for all
    using (auth.role() = 'service_role');
```

### Public Read, Auth Write
```sql
-- Anyone can read, only authenticated can write
create policy "Public read"
    on public.posts for select
    using (true);

create policy "Auth write"
    on public.posts for insert
    with check (auth.uid() is not null);
```

## pgvector Usage

```sql
-- Enable extension (already done in migrations)
create extension if not exists vector;

-- Create embedding column
alter table public.documents
    add column embedding vector(1536);  -- OpenAI ada-002 dimension

-- Similarity search
select *
from public.documents
order by embedding <-> '[...]'::vector
limit 10;

-- Create index for faster search
create index on public.documents
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);
```

## Search Patterns (JIT)

```bash
# Find all tables
rg "create table" migrations/ -l

# Find RLS policies
rg "create policy" migrations/

# Find indexes
rg "create index" migrations/

# Find functions
rg "create.*function" migrations/

# List migrations in order
ls -la migrations/
```

## Common Gotchas

1. **Migration Order**
   - Migrations run in alphabetical order
   - Use timestamp prefix: `YYYYMMDDHHMMSS_name.sql`
   - Never modify applied migrations

2. **RLS Must Be Enabled**
   - Every table with user data needs RLS
   - Always add `alter table ... enable row level security`
   - Test policies before deploying

3. **Foreign Keys**
   - Always use `on delete cascade` for user-owned data
   - Reference `auth.users(id)` not custom user tables

4. **Type Generation**
   - Run `supabase gen types` after migrations
   - Commit generated types to repo

## Pre-PR Checks

```bash
# Validate migrations can apply
supabase db reset && echo "✅ Migrations valid"

# Generate fresh types
supabase gen types typescript --local > ../apps/web/types/database.ts
```

## Adding New Tables

1. Create migration file with timestamp prefix
2. Define table with proper types and constraints
3. Enable RLS and create policies
4. Add indexes for query performance
5. Add updated_at trigger if needed
6. Run `supabase db push` to test
7. Generate TypeScript types

```sql
-- Template for new table
create table if not exists public.new_table (
    -- Primary key
    id uuid default gen_random_uuid() primary key,

    -- Foreign keys
    user_id uuid references auth.users(id) on delete cascade not null,

    -- Data columns
    name text not null,
    description text,
    metadata jsonb default '{}'::jsonb,

    -- Timestamps
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- RLS
alter table public.new_table enable row level security;

create policy "Users own data"
    on public.new_table for all
    using (auth.uid() = user_id);

-- Indexes
create index if not exists new_table_user_id_idx
    on public.new_table(user_id);

-- Updated trigger
create trigger new_table_updated_at
    before update on public.new_table
    for each row execute function public.handle_updated_at();
```

---

**Parent**: [Root AGENTS.md](../../AGENTS.md)
