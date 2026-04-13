# CCW-Online ERP

Full-stack Equipment Supplier ERP/CRM. Next.js + FastAPI + PostgreSQL (Supabase). Single npm package at the repo root; App Router in `src/app/`.

## Commands

- **Dev**: `npm run dev`
- **Test**: `npm run test` (single file: `npx vitest run path/to/file`)
- **Type-check**: `npm run type-check`
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Backend only**: `cd backend && uv run uvicorn src.api.main:app --reload`
- **Backend tests**: `cd backend && uv run pytest`
- **Format**: `npm run format`

## Rules

1. Run `npm run type-check` after every code change. Zero errors required.
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
13. Report changes in commit messages and PR descriptions; optional notes under `docs/` when useful.
14. After any task, run relevant test scope and verify output before reporting done.

## Architecture

Before structural changes or new features, read `docs/README.md`, `docs/catalogs/`, and `docs/PRODUCT-OVERVIEW.md` as needed.

## Standards

Follow existing patterns in `src/` (TypeScript strict, shadcn/ui, `apiClient`). See `eslint.config.mjs` and this file’s Rules section.

## Testing

Run `npm run test` / `npm run type-check` as appropriate. See `docs/testing/` for historical verification notes.

## Investigation Rule

Read relevant source files before making claims about this codebase.
Never speculate about code, APIs, or data structures you haven't opened.
