# CCW-Online ERP

Full-stack Equipment Supplier ERP/CRM. Next.js 15 + FastAPI + PostgreSQL (Supabase). Monorepo managed by pnpm + Turbo.

## Commands

- **Dev**: `pnpm dev` (all services via Turbo)
- **Test**: `pnpm turbo run test` (single: `cd apps/web && npx vitest run path/to/file`)
- **Type-check**: `pnpm turbo run type-check`
- **Lint**: `pnpm turbo run lint`
- **Build**: `pnpm turbo run build`
- **Backend only**: `cd apps/backend && uv run uvicorn src.api.main:app --reload`
- **Backend tests**: `cd apps/backend && uv run pytest`
- **Format**: `pnpm format`

## Rules

1. Run `pnpm turbo run type-check` after every code change. Zero errors required.
2. Read the source files before making claims. Use Glob/Grep/Read, not speculation.
3. Use `/plan` before coding. Show plan, get approval, then implement exactly as planned.
4. Preserve existing API response shapes. Add optional fields freely; remove nothing.
5. Use `apiClient` from `@/lib/api/client` for all frontend HTTP calls.
6. Use Zod (frontend) + Pydantic (backend) for all validation.
7. Use `@/components/ui/` (shadcn) components and `bg-primary` design tokens, not raw colors.
8. Keep frontend state in React hooks. No Redux/Zustand.
9. Use `structlog` for backend logging. Use `httpx` async client for integrations.
10. New routes/pages/models: check `docs/catalogs/` first, update after adding.
11. Three locked files exist — see Architecture doc for details.
12. Commit messages: `feat|fix|chore|docs(scope): description`.
13. Report changes using the progress format in PROGRESS.md after each task.
14. After any task, run relevant test scope and verify output before reporting done.

## Architecture

Read `.claude/ARCHITECTURE.md` before structural changes or new features.

## Standards

Read `.claude/STANDARDS.md` before writing new modules or refactoring.

## Testing

Read `.claude/TESTING.md` for verification. After any task, run the relevant
test scope and verify output before reporting completion.

## Current State

Read `.claude/PROGRESS.md` at the start of every new context window.
Update it when completing tasks or making significant decisions.

## Memory

Living state is in `.claude/memory/`:
- `current-state.md` — active sprint, in-progress work
- `CONSTITUTION.md` — immutable prohibitions
- `decisions-log.md` — append-only architecture decisions

## Context Management

Context will be compacted automatically. Do not stop tasks early due to
context concerns. When compacting, preserve: modified file list, test
commands, active task state from PROGRESS.md, and uncommitted decisions.

When starting a fresh context window:
1. Read `.claude/PROGRESS.md` for current state
2. Read `git log --oneline -10` for recent changes
3. Run `pnpm turbo run type-check` to verify environment
4. Continue from the next task in PROGRESS.md

## Investigation Rule

Read relevant source files before making claims about this codebase.
Never speculate about code, APIs, or data structures you haven't opened.
