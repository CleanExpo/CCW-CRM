# Domain Memory System - Setup Guide

Complete guide for setting up and verifying the domain memory system for both new and existing projects.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [New Project Setup](#new-project-setup)
- [Existing Project Setup](#existing-project-setup)
- [Verification](#verification)
- [Database Tables](#database-tables)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Quick Start

### For New Projects

```powershell
# 1. Start Supabase
cd "D:\Node JS Starter V1"
supabase start

# 2. Apply all migrations (fresh database)
.\scripts\init-database.ps1 -Reset -Verify

# 3. Verify setup
cd apps\backend
uv run python scripts\setup-memory.py

# 4. Run tests
uv run pytest tests\test_memory*.py -v
```

### For Existing Projects

```powershell
# 1. Apply new migrations only
cd "D:\Node JS Starter V1"
.\scripts\init-database.ps1 -Verify

# 2. Verify setup
cd apps\backend
uv run python scripts\setup-memory.py

# 3. Run all tests
uv run pytest -v
```

## Prerequisites

### Required Software

- **Docker Desktop** - Running and configured
- **Node.js** - Version 18 or higher
- **Python** - Version 3.12 or higher
- **pnpm** - Installed globally (`npm install -g pnpm`)
- **uv** - Python package manager (installed via `pip install uv`)

### Required Environment Variables

Create a `.env` file in the root directory with:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Embeddings (Optional - for semantic search)
OPENAI_API_KEY=sk-...

# Anthropic (Required for agents)
ANTHROPIC_API_KEY=sk-ant-...
```

**Get Supabase keys:**
```powershell
supabase start
# Keys are displayed in the output
```

## New Project Setup

Follow these steps for a fresh project installation:

### 1. Install Dependencies

```powershell
# Install root dependencies
cd "D:\Node JS Starter V1"
pnpm install

# Install backend dependencies
cd apps\backend
uv sync
```

### 2. Configure Environment

```powershell
# Copy example environment file
cd "D:\Node JS Starter V1"
cp .env.example .env

# Edit .env and add your keys
```

### 3. Initialize Database

```powershell
# Start Supabase (will download containers on first run)
supabase start

# Wait for "Started supabase" message, then initialize database
.\scripts\init-database.ps1 -Reset -Verify
```

**What this does:**
- Drops all existing data (if any)
- Applies all 8 migrations in order
- Creates all domain memory tables
- Enables pgvector extension
- Sets up RLS policies and indexes
- Verifies everything is correct

### 4. Verify Setup

```powershell
cd apps\backend
uv run python scripts\setup-memory.py
```

**Expected output:**
```
✅ Supabase URL: http://localhost:54321
✅ Supabase service key configured
✅ Database connection successful
✅ MemoryStore initialized successfully
✅ Embedding provider working
✅ All checks passed!
```

### 5. Run Tests

```powershell
# Run all memory tests
uv run pytest tests\test_memory*.py -v

# Run integration tests
uv run pytest tests\integration\ -v -m integration

# Run performance benchmarks
uv run pytest tests\performance\ -v -m performance -s
```

**Expected result:** All tests should pass ✅

### 6. Start Development

```powershell
cd "D:\Node JS Starter V1"
pnpm dev
```

**Services:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Supabase Studio: http://localhost:54323

## Existing Project Setup

For projects that already have the domain memory system:

### 1. Update Database

```powershell
cd "D:\Node JS Starter V1"

# Apply only new migrations
.\scripts\init-database.ps1
```

**If you encounter errors:**
```powershell
# Reset database (CAUTION: drops all data)
.\scripts\init-database.ps1 -Reset -Verify
```

### 2. Verify Setup

```powershell
cd apps\backend
uv run python scripts\setup-memory.py
```

### 3. Run Tests

```powershell
uv run pytest -v
```

## Verification

### Manual Database Verification

```powershell
# Run validation script
cd "D:\Node JS Starter V1"
.\scripts\validate-database.ps1 -Verbose
```

**Checks performed:**
- ✅ Supabase is running
- ✅ All migrations applied
- ✅ pgvector extension installed
- ✅ All memory tables exist
- ✅ Proper table structure
- ✅ Indexes created
- ✅ RLS policies configured

### Python Setup Verification

```powershell
cd apps\backend
uv run python scripts\setup-memory.py
```

**Checks performed:**
- ✅ Environment variables set
- ✅ Database connection works
- ✅ MemoryStore initializes
- ✅ Embedding generation works
- ✅ CRUD operations work
- ✅ SupabaseStateStore integration works

## Database Tables

The domain memory system creates the following tables:

| Table | Purpose | Key Features |
|-------|---------|-------------|
| `domain_memories` | Core memory storage | Vector embeddings, RLS, full-text search |
| `domain_knowledge` | Project knowledge | Architectural decisions, patterns, conventions |
| `user_preferences` | User-specific settings | Coding style, communication preferences |
| `test_failure_patterns` | Test failure tracking | Error signatures, solutions |
| `test_results` | Test execution history | Pass/fail tracking, coverage |
| `debugging_sessions` | Debug investigation state | Hypotheses, findings, resolutions |

### Key Indexes

- `idx_domain_memories_domain` - Fast domain filtering
- `idx_domain_memories_category` - Fast category filtering
- `idx_domain_memories_user_id` - User-specific queries
- `idx_domain_memories_embedding` - Vector similarity search (HNSW)
- `idx_domain_memories_tags` - Tag-based queries (GIN)

### Row Level Security (RLS)

All tables have RLS policies:
- Users can only access their own memories (when `user_id` is set)
- Service role can access all memories
- Public memories (no `user_id`) are accessible to all authenticated users

## Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL       # Supabase API URL
SUPABASE_SERVICE_ROLE_KEY      # Service role key (backend only)
```

### Optional

```env
OPENAI_API_KEY                 # For embeddings (recommended for production)
ANTHROPIC_API_KEY              # For agents (if using Anthropic embeddings)
```

### Embedding Provider Selection

The system automatically selects an embedding provider:

1. **OpenAI** (preferred) - If `OPENAI_API_KEY` is set
   - Uses `text-embedding-3-small` model
   - 1536 dimensions
   - Production-ready

2. **Anthropic** (placeholder) - If only `ANTHROPIC_API_KEY` is set
   - Returns zero vector (placeholder)
   - Not yet available from Anthropic

3. **Simple** (fallback) - If no API keys
   - Hash-based embedding
   - Deterministic
   - **Development only** (not for production)

## Troubleshooting

### Docker Not Running

**Error:** `failed to connect to the docker API`

**Solution:**
1. Start Docker Desktop
2. Wait for "Engine running" status
3. Retry command

### Migration Errors

**Error:** `policy already exists` or `table already exists`

**Solution:**
```powershell
# Clean slate - WARNING: deletes all data
.\scripts\init-database.ps1 -Reset -Verify
```

### Supabase Not Starting

**Error:** `Error starting services`

**Common causes:**
- Port conflicts (54321, 54323 in use)
- Docker out of memory
- Previous instance not stopped

**Solution:**
```powershell
# Stop any existing instances
supabase stop

# Remove all containers
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)

# Restart
supabase start
```

### No Embedding Provider

**Warning:** `No embedding API key (will use simple provider)`

**Impact:**
- System works but uses hash-based embeddings
- Semantic search quality reduced
- **OK for development, not for production**

**Solution:**
```env
# Add to .env
OPENAI_API_KEY=sk-...
```

### Database Connection Failed

**Error:** `Failed to connect to Supabase`

**Check:**
1. Is Supabase running? `supabase status`
2. Are environment variables set? Check `.env` file
3. Is the service role key correct?

**Solution:**
```powershell
# Verify Supabase is running
supabase status

# Check connection info
supabase status | findstr "API URL"

# Update .env with correct values
```

### Tests Failing

**Common causes:**
1. Database not initialized
2. Migrations not applied
3. Test data conflicts

**Solution:**
```powershell
# Reset database
.\scripts\init-database.ps1 -Reset

# Verify setup
cd apps\backend
uv run python scripts\setup-memory.py

# Run tests
uv run pytest -v --tb=short
```

### Performance Issues

**Slow vector search:**
1. Check if embeddings are generated
2. Verify HNSW index exists
3. Consider reducing `match_count` parameter

**Slow CRUD operations:**
1. Check database connection pooling
2. Verify indexes are being used
3. Monitor Supabase logs

## Next Steps

Once setup is complete:

1. **Read the architecture docs:** `docs/domain-memory-architecture.md`
2. **Explore the examples:** `apps/backend/src/memory/examples/`
3. **Integrate with your agents:** See agent integration guide
4. **Monitor performance:** Run benchmarks regularly

## Support

- **Issues:** https://github.com/yourusername/yourproject/issues
- **Docs:** `docs/`
- **Examples:** `apps/backend/src/memory/examples/`

---

**Last updated:** December 2025
