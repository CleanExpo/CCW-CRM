# CLAUDE.md

> **Guidance for Claude Code when working with this repository**

## Overview

**Monorepo**: Next.js 15 + FastAPI/LangGraph + Supabase with AI agent orchestration

**Stack**: React 19, Tailwind v4, Python 3.12, PostgreSQL, pgvector

## Quick Commands

```bash
# Development
pnpm dev                          # All services
pnpm dev --filter=web             # Frontend only
cd apps/backend && uv run uvicorn src.api.main:app --reload  # Backend only

# Database
supabase start && supabase db push   # Start and apply migrations
.\scripts\init-database.ps1          # Initialize with validation

# Quality Checks
pnpm turbo run type-check lint test  # All checks
.\scripts\health-check.ps1            # System health check
.\scripts\health-check.ps1 -Quick     # Fast check

# Pre-PR Validation
pnpm turbo run type-check lint test && echo "✅ Ready for PR"
```

## Architecture

| Layer | Path | Stack |
|-------|------|-------|
| Frontend | `apps/web/` | Next.js 15, React 19, Tailwind v4, shadcn/ui |
| Backend | `apps/backend/src/` | FastAPI, LangGraph, Pydantic, async |
| Database | `supabase/` | PostgreSQL, pgvector, RLS |

**Key Modules**:
- `agents/` - Orchestrator, long-running agents, base classes
- `tools/` - Tool registry, search, programmatic calling
- `verification/` - Independent verification system
- `memory/` - Vector-based persistent memory
- `skills/` - SKILL.md parser and routing

## Environment Variables

Required in `.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
BACKEND_URL=http://localhost:8000
```

## Coding Standards

### Frontend
- **Layers**: Components → Hooks → API Routes → Services → Repositories
- **Types**: Explicit return types, no `any`, strict mode
- **Naming**: React `PascalCase.tsx`, utils `kebab-case.ts`
- **Patterns**: API routes use try/catch + validate + service

### Backend
- **Naming**: Python `snake_case.py`, skills `SCREAMING-KEBAB.md`
- **Types**: Type hints, Pydantic, strict mypy
- **Async**: async/await pattern, FastAPI best practices
- **Standards**: PEP 8, explicit error handling

### General Rules
- No cross-layer imports
- Components handle loading/error/empty states
- Verification-first approach (run actual tests)
- No self-attestation (agents can't verify own work)

## Database

**8 Migrations** in `supabase/migrations/`:
1. init - UUID, triggers
2. auth_schema - profiles, RLS
3. enable_pgvector - vectors, embeddings
4. state_tables - conversations, tasks
5. audit_evidence - verification system
6. copywriting_consistency - business data
7. agent_runs_realtime - real-time agent status
8. domain_memory - persistent memory

## Agent Development

**Create new agent**:
1. Extend `BaseAgent` in `agents/`
2. Register in `AgentRegistry`
3. Add `SKILL.md` in `/skills`
4. Use `start_task()`, `report_output()`, `get_task_output()`

## Workflow Best Practices

### 1. Explore, Plan, Code, Verify
- **Explore**: Read files, understand patterns
- **Plan**: Document approach before coding
- **Code**: Implement with tests
- **Verify**: Run actual tests (never assume)

### 2. Verification First
- Run actual build/tests
- Check actual output
- Confirm expected behavior
- **NEVER mark complete without verification**

### 3. Test-Driven Development
- Write tests first (expected input/output)
- Confirm tests fail
- Write code to pass tests
- Commit separately

### 4. Effective Prompting
```
❌ "add tests for foo.py"
✅ "write test for foo.py covering logout edge case, avoid mocks"

❌ "add a calendar widget"
✅ "follow HotDogWidget.php pattern to implement calendar with month/year pagination"
```

## Memory System

Uses Claude's modular memory:
- **Main**: `.claude/CLAUDE.md` (project memory)
- **Rules**: `.claude/rules/` (path-specific, auto-load)
- **Docs**: `docs/claude-memory-system.md`

**Hierarchy**: Enterprise → Project → Rules → User → Local

## Commands & Tools

```bash
/init              # Generate CLAUDE.md
/permissions       # Manage tool allowlist
/clear             # Reset context
#                  # Add instruction to CLAUDE.md
```

**Extended Thinking**: Use "think", "think hard", "think harder", "ultrathink"

## AGENTS.md Hierarchy

Path-specific AGENTS.md files (nearest-wins):
- Root: `AGENTS.md` - Universal commands
- Frontend: `apps/web/AGENTS.md` - Components, patterns
- Backend: `apps/backend/AGENTS.md` - FastAPI, agents
- Database: `supabase/AGENTS.md` - Migrations, RLS
- Skills: `skills/AGENTS.md` - Skill format, routing

---

**For detailed patterns**, see path-specific rules in `.claude/rules/` that auto-load based on files you're working on.
