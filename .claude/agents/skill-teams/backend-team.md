# Backend Skill Team

**Trigger**: Assigned a Linear issue tagged `backend`
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/backend/src/api/` · `apps/backend/src/db/`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `.claude/STANDARDS.md` — code patterns
4. `.claude/TESTING.md` — test commands
5. The Linear issue body (passed to you by orchestrator)

**Locked files — never touch:**

- `apps/backend/src/db/demo_models.py`
- `apps/backend/src/api/routes/demo_auth.py`

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- AU locale: AUD, GST, ATO, BAS, DD/MM/YYYY, AEST/AEDT
- Use Pydantic for all validation
- Use `structlog` for all logging
- Use `httpx` async client for integrations
- Preserve existing API response shapes — add optional fields, remove nothing
- Check `docs/catalogs/ROUTES.md` before adding new routes

---

## WORKFLOW

### Step 1: Parse the issue

From the Linear issue extract:

- **Title**: what to build
- **Acceptance criteria**: testable checklist
- **Effort estimate**: scope check
- **Teams assigned**: confirm `backend` is listed

### Step 2: Create worktree

```bash
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

### Step 3: Plan the migration (if schema change)

If the issue requires a DB schema change:

1. Check `supabase/migrations/` for existing pattern
2. Write the migration SQL first, get review before proceeding
3. Test migration on local Supabase (`supabase db push`)

### Step 4: Dispatch executor subagent (Haiku 4.5)

Provide the executor with:

- Full Linear issue body
- Exact acceptance criteria
- Migration SQL (if applicable)
- File paths to modify
- Instruction to write failing tests first (TDD)
- Instruction to run `cd apps/backend && uv run pytest` after each change

### Step 5: Review

After executor reports DONE:

1. Run `cd apps/backend && uv run pytest` — all tests pass
2. Run `pnpm turbo run type-check` — zero errors
3. Check each acceptance criterion is met
4. Verify AU compliance (GST, BAS, ATO where applicable)
5. Dispatch code quality reviewer

### Step 6: PR

```bash
gh pr create \
  --title "feat(backend): <issue title>" \
  --body "Closes <Linear issue URL>

## Changes
<bullet list>

## Migration
<SQL or 'none'>

## Test plan
<how to verify>"
```

---

## QUALITY GATES

Before any PR:

- [ ] `cd apps/backend && uv run pytest` — all pass
- [ ] `pnpm turbo run type-check` — zero errors
- [ ] Locked files untouched
- [ ] Existing API response shapes preserved
- [ ] AU locale correct (AUD, GST, ATO where applicable)
- [ ] `structlog` used for logging (not print/logging.info)
- [ ] Pydantic validation on all inputs
- [ ] `docs/catalogs/ROUTES.md` updated if new routes added
