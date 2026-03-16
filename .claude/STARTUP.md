# STARTUP INSTRUCTIONS — READ FIRST

> This file MUST be read at the start of every Claude Code session.
> If you're seeing this, you're doing it right.

## STEP 1: Read the Rules

Before doing ANYTHING, read these files in order:

1. `CLAUDE.md` (root) — Quick reference & architecture guide
2. `.claude/CLAUDE.md` — Full system instructions & workflow

## STEP 2: Confirm Understanding

After reading, you should know:

- [x] What CCW-ERP-CRM is (Equipment Supplier ERP/CRM)
- [x] Tech stack (Next.js 15 + FastAPI + PostgreSQL + Supabase + Vercel)
- [x] Monorepo structure (apps/web, apps/backend)
- [x] What's forbidden (schema changes, auth changes, breaking API changes)
- [x] What the workflow is (plan -> approve -> code -> test)
- [x] Current state (deployed production app with Cin7 integration, AI agents, POS)

## STEP 3: Check Current State

Run mental checklist:

- Is there an active task? Check `.claude/.execution`
- Is there an approved plan? Look for recent planning conversation
- What was last done? Check git log

## STEP 3.5: Read Anti-Drift Memory Files

ALWAYS read these files before any major decision:

```bash
cat .claude/memory/CONSTITUTION.md    # Immutable rules
cat .claude/memory/current-state.md   # Active sprint + in-progress work
cat .claude/memory/handoff.md         # Previous session context
```

Check catalog freshness (run if catalogs might be stale):

- If any catalog in docs/catalogs/ has "Last Verified" > 7 days ago, run /pi-scan-\* to refresh it
- Catalogs are the source of truth — don't re-scan codebase if catalogs are fresh

If context snapshot exists (.claude/memory/context-snapshot.md has recent content):

- Read it — context compaction occurred, memory was saved
- Re-read CONSTITUTION.md + current-state.md immediately

## STEP 4: Wait for Instructions

Do NOT start working until user gives you a task.
Do NOT suggest things to do.
Do NOT "help" by doing random cleanup.

Just say:
"I've read the project instructions. What would you like to work on?"

---

## QUICK REFERENCE

**Project:** CCW-ERP-CRM
**Type:** Full-stack Equipment Supplier ERP/CRM
**Mode:** Production (deployed)
**Path:** D:\CCW-ERP-CRM

**Current Status:**

- Full CRUD (Products, Customers, Orders, Quotes) — complete
- Cin7 Integration (7 phases) — complete
- AI Agents (forecasting, anomaly detection) — complete
- Agents Protocol v1.0 (multi-agent governance) — complete
- POS system — complete
- Supabase Cloud + Vercel deployment — complete
- 321 integration test assertions, all passing

**Tech Stack:**

- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4 (Vercel)
- Backend: FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2
- Database: PostgreSQL 15 — Supabase Cloud (prod), Docker (local)
- Package Manager: pnpm (monorepo with Turbo)

**Commands:**

- `/plan` — Create implementation plan (REQUIRED before coding)
- `/spec` — Read project specification
- `/test` — Run tests (frontend: pnpm test, backend: pytest)
- `/audit` — Check project structure
- `/reset` — Re-read all configs

**Forbidden (NEVER DO):**

- Modifying database schema (apps/backend/src/db/demo_models.py)
- Changing auth code (middleware.ts, demo_auth.py)
- Breaking API contracts (existing endpoints)
- Installing packages without approval
- Coding without approved plan
- Assuming what user wants

**Encouraged:**

- Adding new components
- Adding new API endpoints
- Using existing patterns
- Writing tests
- Following existing code style

---

**REMEMBER: When in doubt, ASK. Don't assume.**

After reading this, proceed to `.claude/CLAUDE.md` for full system instructions.
