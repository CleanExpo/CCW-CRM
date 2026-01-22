# 🚨 STARTUP INSTRUCTIONS — READ FIRST

> This file MUST be read at the start of every Claude Code session.
> If you're seeing this, you're doing it right.

## STEP 1: Read the Rules

Before doing ANYTHING, read these files in order:

1. `CLAUDE.md` (root) — Quick reference & architecture guide
2. `.claude/CLAUDE.md` — Full system instructions & workflow
3. `docs/IMPLEMENTATION-PROGRESS.md` — Current project status
4. `.claude/.execution` — Active task state

## STEP 2: Confirm Understanding

After reading, you should know:
- [x] What CCW-Online ERP is (Equipment Supplier ERP)
- [x] Tech stack (Next.js 15 + FastAPI + PostgreSQL)
- [x] Monorepo structure (apps/web, apps/backend)
- [x] What's forbidden (schema changes, auth changes, breaking API changes)
- [x] What the workflow is (plan → approve → code → test)
- [x] Current phase (Phase 1: i18n Complete, ready for Phase 2 or 4)

## STEP 3: Check Current State

Run mental checklist:
- Is there an active task? Check `.claude/.execution`
- Is there an approved plan? Look for recent planning conversation
- What was last done? Check git log or IMPLEMENTATION-PROGRESS.md
- What phase are we in? Check IMPLEMENTATION-PROGRESS.md

## STEP 4: Wait for Instructions

Do NOT start working until user gives you a task.
Do NOT suggest things to do.
Do NOT "help" by doing random cleanup.

Just say:
"I've read the project instructions. What would you like to work on?"

---

## QUICK REFERENCE

**Project:** CCW-Online ERP
**Type:** Full-stack Equipment Supplier ERP
**Mode:** Development
**Current Status:** Phase 1 (i18n) Complete ✅

**Tech Stack:**
- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4
- Backend: FastAPI (Python 3.12), SQLAlchemy 2.0, Pydantic v2
- Database: PostgreSQL 15 (Docker)
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

## CURRENT PROJECT STATE

**Phase 1: Multi-Language Foundation (i18n)** - ✅ COMPLETE (9/9 tasks)
- Database schema (6 tables for translations)
- AI-powered translation service (Ollama integration)
- Translation Management Dashboard
- 10 languages supported (3 fully translated)
- Cookie-based language switcher
- Demo page at `/demo/i18n`

**Next Phases:**
- Phase 2: Google AP2 Integration (7 tasks)
- Phase 3: Enhanced Shopify Backend (5 tasks)
- Phase 4: AI-Powered Search & Recommendations (8 tasks) ⭐ Recommended next
- Phase 5: Autonomous Development Framework (4 tasks)

---

**REMEMBER: When in doubt, ASK. Don't assume.**

After reading this, proceed to `.claude/CLAUDE.md` for full system instructions.
