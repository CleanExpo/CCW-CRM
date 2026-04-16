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

## Skills

Skills live in `.claude/skills/[name]/SKILL.md`. Read `.claude/skills/CHROME-SKILLS-INDEX.md` for the full Chrome automation index.

**Auto-discovery rule**: Before any task involving a browser, Linear, Vercel, Supabase, YouTube, or GitHub — scan `.claude/skills/` with Glob and use the matching skill. Do NOT ask the user which skill to use.

**Auto-generation rule**: If no skill exists for a task, create `.claude/skills/[task-name]/SKILL.md` before starting. Follow the format of existing skills.

### Chrome browser skills (use `mcp__Claude_in_Chrome__*` tools)

| Skill directory   | Use for                                         |
| ----------------- | ----------------------------------------------- |
| `chrome-linear`   | View/triage Linear board, update issue statuses |
| `chrome-vercel`   | Deployment status, build logs, env vars         |
| `chrome-supabase` | RLS audit, SQL editor, JWT hook activation      |
| `chrome-youtube`  | Upload/schedule videos, channel status          |
| `chrome-github`   | PRs, CI status, diffs, merges                   |
| `chrome-prod`     | Full smoke test of ccw-crm-web.vercel.app       |

## Investigation Rule

Read relevant source files before making claims about this codebase.
Never speculate about code, APIs, or data structures you haven't opened.

---

## Karpathy-Inspired Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
