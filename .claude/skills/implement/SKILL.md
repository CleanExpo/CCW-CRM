# Implement Skill

**Name:** implement
**Triggers:** `/implement` (manual invocation only — not natural language)
**Version:** 1.0.0

---

## Purpose

Three-phase structured build pipeline: PLAN → BUILD → VERIFY. Each phase runs in an isolated subagent context so the main session sees only the verdict, not the file-by-file walkthrough. Designed to drive a complete feature from approved plan to commit-ready code without polluting the main conversation.

This skill is **manual invocation only** (no natural-language triggers). It runs the heaviest workflow in the system and should never fire unintentionally.

---

## Commands

### `/implement <feature description>`

Runs the full three-phase pipeline. Stops between phases to surface the result to the CEO for approval.

---

## Phase 1 — PLAN

Dispatches to the existing **`planner.md`** agent at `.claude/agents/planner.md`. The planner produces the project's standard plan template (Objective / Files / Steps / Tests / Risks / Breaking Changes) and surfaces it to the CEO. **STOP — wait for explicit approval before Phase 2.**

If the user has already approved a plan in the current session, skip to Phase 2 with the existing plan.

---

## Phase 2 — BUILD

Dispatches to the existing **`coder.md`** agent at `.claude/agents/coder.md`. The coder follows the approved plan exactly:

- One file at a time
- Tests written alongside implementation (Vitest for frontend, Pytest for backend)
- Reference patterns: `apps/web/components/auth/login-form.tsx` (frontend forms), `apps/backend/src/api/routes/translations.py` (backend routes)
- No locked files touched (`demo_models.py`, `demo_auth.py`, `middleware.ts`)
- Commits after each logical unit, NOT at the end

---

## Phase 3 — VERIFY

Runs the project's quality gate inside the subagent and reports pass/fail to main context:

```bash
# Frontend
pnpm turbo run lint
pnpm turbo run type-check
pnpm turbo run test

# Backend
cd apps/backend && uv run ruff check
cd apps/backend && uv run mypy src/
cd apps/backend && uv run pytest tests/api/test_<module>.py
```

**All green = ready for review chain.** Single red line = STOP, surface to CEO with the exact failure.

After verification passes, the skill recommends invoking the heavyweight review chain (`@code-reviewer` → `@security-auditor` → `@database-specialist` → `@deploy-guardian` → `@orchestrator`) before any PR.

---

## Process Rules

1. **Never skip a phase.** PLAN before BUILD before VERIFY — no shortcuts.
2. **Never auto-commit final results.** The skill stages and prepares but the human CEO approves the actual commit.
3. **Phase boundaries are hard.** A failure in Phase 2 does not roll back to Phase 1; it surfaces and stops.
4. **Reference patterns mandatory.** New code must match `login-form.tsx` and `translations.py` shape — no inventing new structure.

---

## When NOT to use this skill

- 1-line fix or typo — use `/fix` instead (much cheaper)
- Architecture exploration — use `/arch-plan` first (read-only)
- The work crosses module boundaries unpredictably — invoke `@erp-build-specialist` for autonomous selection
- The work requires schema changes — STOP, escalate via Linear ticket

---

## Related

- `.claude/agents/planner.md` — Phase 1 dispatch target
- `.claude/agents/coder.md` — Phase 2 dispatch target
- `.claude/skills/arch-plan/SKILL.md` — lightweight planning alternative
- `.claude/skills/autonomous-build/SKILL.md` — autonomous version that selects work AND implements
- `MANAGED_AGENTS_v4_FINAL.md` § Autonomous Deploy Gate — review chain that runs after this skill
