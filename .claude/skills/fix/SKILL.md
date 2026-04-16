# Fix Skill

**Name:** fix
**Triggers:** `/fix`, "quick fix for", "patch this bug"
**Version:** 1.0.0

---

## Purpose

Minimal-context targeted fix. Reads only the implicated files (line ranges, never full files), makes the minimum viable change, runs the targeted test, and reports under 80 words. The cheapest skill in the pack — designed for typos, missing nullchecks, wrong constants, off-by-one errors, and other surgical edits.

This is the opposite end of the spectrum from `/implement`. Use it when the fix is obvious and the only question is whether you can land it without burning context on exploration.

---

## Commands

### `/fix <description with file path or symptom>`

Makes the minimum viable change. Examples:

- `/fix typo in apps/web/components/auth/login-form.tsx line 47`
- `/fix null check missing on order.customer_id in orders.py`
- `/fix wrong status code on POST /api/products (should be 201)`

**Returns to main context (≤80 words):**

- What changed (file:line, before → after)
- Test result (passed / failed with one-line reason)

---

## Process Rules

1. **One file by default.** If the fix needs more than one file, the skill still runs but flags it: "Multi-file fix — consider `/implement` instead?"
2. **Line-range reads only.** Use `Read` with `offset` + `limit` to load only the relevant function or block.
3. **Min-viable change.** Do not refactor surrounding code. Do not "improve" anything not asked. Do not add docstrings, type hints, or tests beyond what the fix needs.
4. **Run one test.** After the change, run the most targeted test that exercises the fix. If no test exists, run the smallest containing file's test.
5. **Word budget.** Output is hard-capped at 80 words. No explanations beyond what changed and the test result.
6. **No locked files.** Hard-fail if the fix touches `apps/backend/src/db/demo_models.py`, `apps/backend/src/api/routes/demo_auth.py`, or `apps/web/middleware.ts`.

---

## When NOT to use this skill

- The fix requires understanding code you haven't seen — use `/research` first
- The fix crosses 3+ files — use `/implement` instead
- You're not sure what the fix is — use `/research` or `/arch-plan` first
- The bug needs a regression test — `/fix` only updates code; for new tests use `/implement` or write the test yourself
- You're touching anything on the locked-files list

---

## Related

- `.claude/skills/research/SKILL.md` — pre-step when the fix location is unknown
- `.claude/skills/implement/SKILL.md` — escalate here if the fix grows beyond surgical
- `.claude/agents/bug-hunter/agent.md` — for harder-to-find bugs that need investigation first
