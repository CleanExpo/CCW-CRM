# Frontend Skill Team

**Trigger**: Assigned a Linear issue tagged `frontend` or `ux`
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/web/**`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `.claude/STANDARDS.md` — code patterns
4. `.claude/TESTING.md` — test commands
5. The Linear issue body (passed to you by orchestrator)

**Locked files — never touch:**

- `apps/web/middleware.ts`

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- AU locale: AUD, DD/MM/YYYY, AEST/AEDT in all user-facing output
- Use `apiClient` from `@/lib/api/client` for all HTTP calls
- Use `@/components/ui/` (shadcn) components and `bg-primary` design tokens
- Keep frontend state in React hooks — no Redux/Zustand
- Use Zod for all validation

---

## WORKFLOW

### Step 1: Parse the issue

From the Linear issue extract:

- **Title**: what to build
- **Acceptance criteria**: the testable checklist
- **Effort estimate**: used to scope your implementation
- **Teams assigned**: confirm `frontend` is listed

If the issue is missing acceptance criteria, STOP and ask the orchestrator to fix the issue before proceeding.

### Step 2: Create worktree

```bash
# Use git worktrees skill to create an isolated branch
# Branch name: feat/linear-<issue-id>-<slug>
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

All implementation work happens in the worktree. Never modify the main checkout.

### Step 3: Dispatch executor subagent (Haiku 4.5)

Provide the executor with:

- The full Linear issue body
- The exact acceptance criteria (numbered list)
- File paths to modify (identify from issue + your reading of the codebase)
- Instruction to write failing tests first (TDD)
- Instruction to run `pnpm turbo run type-check` after every change (zero errors required)

The executor reports back: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

### Step 4: Review

After executor reports DONE:

1. Run `pnpm turbo run type-check lint test` — must all pass
2. Check each acceptance criterion is met (read the code, don't trust executor's word)
3. Dispatch code quality reviewer (Sonnet 4.6) for final check

### Step 5: PR

```bash
gh pr create \
  --title "feat(web): <issue title>" \
  --body "Closes <Linear issue URL>

## Changes
<bullet list>

## Acceptance criteria
<paste checklist with checkmarks>

## Test plan
<how to verify>"
```

Base branch: `ai-updates`

### Step 6: Report to orchestrator

Post a comment on the Linear issue:

- PR URL
- All acceptance criteria met (yes/no per item)
- Any deferred items (with reason)

---

## QUALITY GATES

Before any PR:

- [ ] `pnpm turbo run type-check` — zero errors
- [ ] `pnpm turbo run lint` — zero warnings in changed files
- [ ] `pnpm turbo run test` — all tests pass
- [ ] AU locale correct (AUD, DD/MM/YYYY)
- [ ] No raw colours — only design tokens
- [ ] No Redux/Zustand introduced
- [ ] Locked files untouched
