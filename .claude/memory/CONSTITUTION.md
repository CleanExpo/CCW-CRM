# CCW ERP/CRM — CONSTITUTION v1.0

# Injected automatically by hooks. Read this. Follow this. Always.

# Last Updated: 2026-03-03

## ABSOLUTE PROHIBITIONS (never, ever)

1. Modify demo_models.py — production schema risk
2. Modify middleware.ts or demo_auth.py — security lockout risk
3. Change existing API response shapes — breaks frontend

## AUTONOMOUS MODE

Default operating mode is autonomous. Pull next Linear ticket, implement, run tests, commit, move on. No approval gates except the three locked files above. Update .claude/memory/decisions-log.md after architectural choices.

## TECH STACK (LOCKED)

Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind v4, shadcn/ui
Backend: FastAPI Python 3.12, SQLAlchemy 2.0, Pydantic v2, PostgreSQL 15
Packages: pnpm (frontend), uv (backend) — no package changes without approval
Database: Supabase Cloud (prod), Docker (local) — DO NOT modify demo_models.py

## AGENT:SKILL LAW

Every specialized agent has exactly 10 skills. Adding an 11th means removing one.

## CATALOG LAW

Before adding any route, page, agent, model, or package — check docs/catalogs/ first.
After adding — update the relevant catalog within the same session.

## 1:10 ARCHITECTURE

10 domain agents, each with exactly 10 documented skills in .claude/commands/

## CURRENT SPRINT

See .claude/memory/current-state.md for active sprint and in-progress work.

## TOOLSHED LAW (9th Governing Law)

Run /toolshed <task> before planning any new feature.
Context assembly precedes reasoning.

- Endpoint: POST /api/ai/toolshed/bundle
- Search: GET /api/ai/toolshed/search?q=<keyword>
- Pattern: GET /api/ai/toolshed/pattern?type=endpoint|component|agent|integration|page
- Quality gate: POST /api/ai/toolshed/verify (run before marking done)
  Violation = planning without codebase context = duplicate routes/wrong patterns/rework.

## ANTI-DRIFT INFRASTRUCTURE

- SessionStart hook: injects CONSTITUTION.md + current-state.md
- UserPromptSubmit hook: re-injects compass check before every message
- PreCompact hook: saves state to context-snapshot.md before compaction
- State files: .claude/memory/ — always read these before major decisions
