# Architecture Plan Skill

**Name:** arch-plan
**Triggers:** `/arch-plan`, "design implementation for", "architect this feature"
**Version:** 1.0.0

---

## Purpose

Lightweight architectural planning that runs in an isolated subagent context. Returns a structured 350-word plan to the main conversation without polluting it with the dozens of file reads the planner walked through.

**This is NOT the canonical interactive planning command.** For interactive planning with CEO approval gates, the project's standard plan template, and the full TASK EXECUTION PROTOCOL, use **`/plan`** (which exists at `.claude/commands/plan.md`). This skill is the cheaper, faster, isolated-context version meant for use inside other subagent workflows (e.g., the `/implement` skill calls `arch-plan` as its first phase).

---

## Commands

### `/arch-plan <feature description>`

Dispatches the planning request to an isolated subagent. The subagent uses grep/glob to understand the relevant codebase area, identifies which files need to change, sequences the steps, and returns a structured plan.

**Returns to main context (≤350 words):**

- **Objective**: 1 sentence — what this feature accomplishes
- **Files to change**: `filepath` + 1-line rationale per file
- **Steps**: numbered, dependency-ordered
- **Tests**: specific cases needed (Vitest + Pytest)
- **Risks**: what could break + how to mitigate

The plan is **read-only** — no code is written, no files are modified. The output goes to the main session for CEO approval before any `/implement` invocation.

---

## Dispatch Target

Routes to the existing **`planner.md`** agent at `.claude/agents/planner.md`. That agent already produces the project's standard plan template (Objective / Files / Steps / Risks / Breaking Changes). This skill wraps it in a lightweight isolated-context invocation.

---

## Process Rules (enforced inside the subagent)

1. **Read-only.** The subagent must NOT call `Write` or `Edit` under any circumstances.
2. **grep/glob first.** Locate relevant files without reading them in full.
3. **Cite reference patterns.** Plans must reference `apps/backend/src/api/routes/translations.py` (backend pattern) and `apps/web/components/auth/login-form.tsx` (frontend pattern) where relevant.
4. **No locked files.** Plans must NOT touch `apps/backend/src/db/demo_models.py`, `apps/backend/src/api/routes/demo_auth.py`, or `apps/web/middleware.ts`.
5. **Word budget.** Output is hard-capped at 350 words.

---

## When NOT to use this skill

- You need interactive multi-round planning with CEO approval — use **`/plan`** instead (canonical interactive command)
- The change is a 1-line fix or typo — use `/fix` instead
- You don't yet know what you want to build — use `/research` first to understand the codebase
- The feature requires schema changes — STOP, escalate to CEO via Linear ticket (schema changes are forbidden)

---

## Related

- `.claude/commands/plan.md` — **canonical interactive planning command** (use this for real planning sessions)
- `.claude/agents/planner.md` — dispatch target
- `.claude/skills/implement/SKILL.md` — calls `arch-plan` as its first phase
- `MANAGED_AGENTS_v4_FINAL.md` — operating protocol that all plans must respect
