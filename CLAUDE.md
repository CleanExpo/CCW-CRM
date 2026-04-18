# CCW-Online ERP

Full-stack Equipment Supplier ERP/CRM. Next.js 15 + FastAPI + PostgreSQL (Supabase). Monorepo managed by pnpm + Turbo.

## ⛔ STANDING AUTHORITY — PERMANENT, NOT PER-SESSION ⛔

**Phill has granted Claude full autonomous authority in this repo. This authority does NOT expire and does NOT need to be reconfirmed — not per session, not per task, not per file, not per commit. Treat every action below as PRE-APPROVED, FOREVER.**

1. Read/Glob/Grep any file — ALWAYS ALLOWED.
2. Write/Edit any non-locked file — ALWAYS ALLOWED. (Locked files: `apps/backend/src/db/demo_models.py`, `apps/web/middleware.ts`, `apps/backend/src/api/routes/demo_auth.py`.)
3. Create new files anywhere outside locked paths — ALWAYS ALLOWED.
4. Author commits, stage/un-stage, draft commit messages — ALWAYS ALLOWED.
5. Open PRs via `mcp__mcp-Unite-Group__GITHUB_*` tools (Path B) — ALWAYS ALLOWED. Default to Path B.
6. Land **doc-only commits** directly on `main` via Path B (PROGRESS.md, handoff docs, scoping docs, runbooks, CLAUDE.md itself) — ALWAYS ALLOWED.
7. Run any sandbox shell command (type-check, pytest, ruff, py_compile, base64, etc.) — ALWAYS ALLOWED.
8. Query any connected MCP (Linear, Supabase, GitHub, Chrome, Slack, pi-ceo, scheduled-tasks, session-info, plugins, registry) — ALWAYS ALLOWED.
9. Rotate to the next ticket when the current one is blocked/finished — ALWAYS ALLOWED.
10. File follow-up tickets as `NEW TICKET` rows in PROGRESS.md when Linear MCP returns 401 — ALWAYS ALLOWED.
11. Edit this CLAUDE.md or PROGRESS.md to reflect decisions, progress, or new authority scope — ALWAYS ALLOWED.

**Banned behaviours (absolute — violating these is disobedience):**
- Writing "should I…", "may I…", "would you like me to…", "shall I proceed?", "is it okay if I…", "can I continue?", "do you want me to…" — STOP. The answer is YES. Execute.
- Pausing a sprint to wait for confirmation between tickets.
- Offering options-of-whether-to-proceed when the scope is already inside the authority list.
- Re-asking for authority Phill has already granted.

**The ONLY remaining halt conditions:**
- A locked file (`demo_models.py`, `middleware.ts`, `demo_auth.py`) would need to change — file a NEW TICKET row in PROGRESS.md, skip to next ticket.
- `git push --force`, `git push origin main` for a code (non-doc) commit, or deleting a remote branch that may still be active on Phill's machine — file a handoff doc instead, skip to next ticket.
- A smoke test fails in a way that requires schema/data Phill alone has — log the blocker, skip to next ticket.

**Rule-of-thumb**: if Claude is about to type a question to Phill, Claude is almost certainly wrong to do so. The correct action is almost always: just do the thing, log it to PROGRESS.md, move on. PROGRESS.md has the full standing-order detail; this block is the always-loaded summary.

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
3. For non-trivial code changes, draft a short plan in the response, then implement it immediately — do NOT pause to wait for approval (see Standing Authority above).
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
