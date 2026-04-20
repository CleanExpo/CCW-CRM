# CCW-Online ERP — Companion Docs

The primary instructions are in the root `CLAUDE.md` (73 lines). This directory holds detailed companion files:

| File              | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `ARCHITECTURE.md` | System overview, component map, locked files, data model, integrations |
| `STANDARDS.md`    | Code patterns (error handling, naming, frontend/backend conventions)   |
| `TESTING.md`      | Test commands, verification checklist, mocking, regression areas       |
| `WORKFLOWS.md`    | Branch naming, commits, PR checklist, deployment, AI tooling           |
| `PROGRESS.md`     | Living state — active tasks, decisions, blockers, session notes        |

## Locked Files (quick reference)

- `apps/backend/src/db/demo_models.py` — schema locked
- `apps/web/middleware.ts` — auth locked
- `apps/backend/src/api/routes/demo_auth.py` — auth locked

## Memory Files

Living state in `.claude/memory/`:

- `current-state.md` — active sprint details
- `CONSTITUTION.md` — immutable prohibitions
- `decisions-log.md` — append-only architecture decisions

## Previous Version

The pre-control-system version is archived at `.claude/CLAUDE.md.pre-control-system` (558 lines).
