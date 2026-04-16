# CCW-Online ERP — Team Onboarding Guide

> Generated 12/04/2026 from project configuration. Keep this up to date when the setup changes.

## What is this project?

CCW-Online ERP is a full-stack Equipment Supplier ERP/CRM for CCW's internal business operations. It handles products, customers, orders, quotes, invoicing, and warehouse management.

**Live at**: Vercel (frontend) + Supabase Cloud (database/auth)

## Tech Stack (locked — changes need explicit approval)

| Layer       | Tech                                 | Notes                                             |
| ----------- | ------------------------------------ | ------------------------------------------------- |
| Frontend    | Next.js 15, React 19, TypeScript 5.7 | App Router                                        |
| Styling     | Tailwind CSS v4, shadcn/ui           | Use design tokens (`bg-primary`), not raw colours |
| Forms       | React Hook Form + Zod                | See `login-form.tsx` for reference pattern        |
| State       | React hooks                          | No Redux/Zustand                                  |
| Backend     | FastAPI, Python 3.12                 | Async throughout                                  |
| ORM         | SQLAlchemy 2.0 (async)               | Pydantic v2 for validation                        |
| Database    | PostgreSQL 15 (Supabase)             | Docker for local dev                              |
| Package mgr | pnpm (frontend), uv (backend)        | Monorepo via Turbo                                |
| API client  | `apiClient` from `@/lib/api/client`  | Handles JWT automatically                         |

## Quick Start

```bash
# Prerequisites: Node 20+, Python 3.12, Docker, pnpm 9+
docker compose up -d                    # PostgreSQL
cd apps/backend && uv run uvicorn src.api.main:app --reload  # Backend
cd apps/web && pnpm dev                 # Frontend
# OR: pnpm dev (all services via Turbo)
```

**Login**: admin@demo.com / demo123

## Three Locked Files

These files are **never modified** without explicit CEO approval + migration plan:

1. `apps/backend/src/db/demo_models.py` — database schema
2. `apps/web/middleware.ts` — JWT auth middleware
3. `apps/backend/src/api/routes/demo_auth.py` — authentication endpoints

**Why**: Schema changes risk production data. Auth changes risk security vulnerabilities. Both have caused incidents before.

## Mandatory Workflow

Every task follows this sequence — no exceptions:

```
Receive task → Read PROGRESS.md → /plan → Get approval → Implement → Test → Report
```

1. **Read `.claude/PROGRESS.md`** at session start for current state
2. **Run `/plan`** before writing any code — creates implementation plan
3. **Get explicit approval** ("approved", "yes", "go ahead") before implementing
4. **Implement** exactly as planned, one file at a time
5. **Test**: `pnpm turbo run type-check lint test` — all must pass
6. **Report** using the format in PROGRESS.md

**Skipping the plan is not allowed.** The project has been burned by unplanned changes before.

## Project Structure

```
CCW-Online-ERP/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/(dashboard)/    # Protected routes (products, customers, orders, quotes)
│   │   ├── components/         # React components
│   │   ├── lib/api/client.ts   # API client (use this for all HTTP calls)
│   │   └── middleware.ts       # LOCKED — JWT auth
│   └── backend/                # FastAPI backend
│       ├── src/api/routes/     # API endpoints
│       ├── src/db/demo_models.py  # LOCKED — database schema
│       └── tests/              # Pytest tests
├── docs/                       # Documentation + specs
├── .claude/                    # Claude Code framework (see below)
└── docker-compose.yml          # PostgreSQL container
```

## Claude Code Framework

The `.claude/` directory contains the AI-assisted development framework:

### Key Files (read these first)

| File                      | Purpose                                                      | When to Read               |
| ------------------------- | ------------------------------------------------------------ | -------------------------- |
| Root `CLAUDE.md`          | 73-line lean router — commands, rules, architecture pointers | Every session start        |
| `.claude/ARCHITECTURE.md` | System overview, component map, locked files, data model     | Before structural changes  |
| `.claude/STANDARDS.md`    | Code patterns, error handling, naming conventions            | Before writing new modules |
| `.claude/TESTING.md`      | Test commands, verification checklist, mocking patterns      | Before/after any task      |
| `.claude/WORKFLOWS.md`    | Branch naming, commits, PR checklist, deployment             | Before PRs                 |
| `.claude/PROGRESS.md`     | Living state: active tasks, decisions, blockers              | Every session start        |

### Memory System

Living state in `.claude/memory/`:

- **`CONSTITUTION.md`** — immutable prohibitions (auto-injected by hooks)
- **`current-state.md`** — active sprint details
- **`decisions-log.md`** — append-only architecture decisions
- **`handoff.md`** — cross-session context

**Rule**: Read `CONSTITUTION.md` and `current-state.md` before any major decision.

### Agents (28 definitions in `.claude/agents/`)

The project uses a multi-agent system for autonomous development:

- **Core 4**: `orchestrator.md`, `planner.md`, `coder.md`, `reviewer.md`
- **Phase 5 control system**: architect, builder, discovery, lead, finalizer, validator, PR manager
- **Review pipeline**: review-orchestrator + 6 specialist reviewers (code quality, database, infrastructure, performance, security, test coverage)
- **Board members**: CEO, CFO, CMO, COO, CSO, CTO — strategic review agents
- **Specialist dirs**: devops-guardian, product-strategist, project-intelligence, senior-orchestrator

### Slash Commands

Key commands available in Claude Code sessions:

| Command             | Purpose                         | When                            |
| ------------------- | ------------------------------- | ------------------------------- |
| `/plan`             | Create implementation plan      | **Mandatory** before any coding |
| `/test`             | Run test suite                  | Before marking task complete    |
| `/audit`            | Check folder structure          | Before deployment               |
| `/spec`             | Read project specifications     | When requirements unclear       |
| `/verify`           | Pre-completion verification     | Before claiming work is done    |
| `/quality-gate`     | Quality checks before ship      | Before PRs                      |
| `/autonomous`       | Run autonomous build session    | For large multi-step tasks      |
| `/health-check-10x` | Full system health verification | When something feels off        |

### Anti-Drift Infrastructure

The project uses hooks to prevent configuration drift:

- **SessionStart hook** — injects CONSTITUTION.md + current-state.md at session start
- **UserPromptSubmit hook** — re-injects compass check before every message
- **PreCompact hook** — saves context snapshot before compaction

These ensure locked files stay locked and mandatory workflows are enforced even across long sessions.

## MCP Servers

The project connects to external tools via MCP:

| Server            | Purpose                                       |
| ----------------- | --------------------------------------------- |
| Linear            | Issue tracking (Unite-Group workspace)        |
| GitHub (Composio) | PR management, code operations                |
| Supabase          | Database operations, migrations               |
| Slack             | Team communication                            |
| Gmail             | Email integration                             |
| Apify             | Web scraping/data collection                  |
| Claude Preview    | Dev server preview                            |
| Claude in Chrome  | Browser automation                            |
| Context7          | Library documentation lookup                  |
| Google Drive      | Document access                               |
| Pi-CEO            | Project intelligence, Linear sync, ship chain |
| Scheduled Tasks   | Recurring automation                          |

## Code Patterns

### Frontend Components

Reference: `apps/web/components/auth/login-form.tsx`

```
"use client" → React Hook Form + Zod → apiClient calls → toast feedback → router.refresh()
```

Key rules:

- Always add loading states (disable button during submit)
- Always catch errors and show toast messages
- Always use `AlertDialog` for delete confirmations
- Always call `router.refresh()` after mutations

### Backend Endpoints

Reference: `apps/backend/src/api/routes/` (existing endpoints)

Key rules:

- Async/await throughout
- Type hints with `Annotated[..., Depends()]`
- Pydantic models for request/response validation
- Proper HTTP status codes (201 create, 204 delete)
- `structlog` for logging, `httpx` for external calls

### API Client

```typescript
import { apiClient } from '@/lib/api/client';

// Handles JWT from cookies automatically
const data = await apiClient.get<Product[]>('/api/products');
await apiClient.post('/api/products', payload);
await apiClient.put(`/api/products/${id}`, payload);
await apiClient.delete(`/api/products/${id}`);
```

## Testing

```bash
pnpm turbo run type-check    # TypeScript — 0 errors required
pnpm turbo run lint           # ESLint — 0 errors required
pnpm turbo run test           # Vitest (frontend) + Pytest (backend)
pnpm turbo run build          # Production build
```

**All four must pass before any task is marked complete.**

Frontend tests: `apps/web/__tests__/`
Backend tests: `apps/backend/tests/`

## Commit Convention

```
feat|fix|chore|docs|test(scope): description
```

Examples:

- `feat(web): add dark mode toggle`
- `fix(backend): resolve agent timeout`
- `chore(.claude): refresh framework settings`

## Current Project State

Read `.claude/PROGRESS.md` for the latest — it's a living document updated after each task.

As of 12/04/2026:

- **CRUD modules**: Complete (Products, Customers, Orders, Quotes)
- **Phase 4 AI Search**: Code complete, activation pending (UNI-1772)
- **Phase 5 Autonomous Framework**: Control system landed, agents operational
- **Video pipeline**: Complete, YouTube uploads quota-gated
- **Framework**: Cleaned of Unite-Group transplant artifacts (UNI-1774)

## What NOT to Do

1. Don't modify the 3 locked files without CEO approval
2. Don't skip `/plan` — ever
3. Don't install packages without asking first
4. Don't create new top-level folders without approval
5. Don't assume — ask when unclear
6. Don't use raw colours — use design tokens
7. Don't add Redux/Zustand — React hooks only
8. Don't upgrade Next.js/React/FastAPI without approval

## Getting Help

- **Project state**: `.claude/PROGRESS.md`
- **Architecture questions**: `.claude/ARCHITECTURE.md`
- **Code patterns**: `.claude/STANDARDS.md`
- **Test failures**: `.claude/TESTING.md`
- **Claude Code issues**: https://github.com/anthropics/claude-code/issues
