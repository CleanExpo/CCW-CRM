# /quality-gate — Run Quality Gates

**Usage**: `/quality-gate`

**Purpose**: Implements Stripe Minions "≤ 2 CI rounds" discipline.
Run before marking **any** task complete or creating a PR.

---

## Quick Run (CLI — Preferred)

```bash
# From monorepo root: D:\CCW-ERP-CRM
pnpm turbo run type-check lint && cd apps/backend && uv run pytest -x -q --tb=short
```

---

## Via API (for agent automation)

```bash
curl -X POST http://localhost:8000/api/ai/toolshed/verify \
  -H "Content-Type: application/json" \
  -d '{"run_frontend": true, "run_backend": true}'
```

---

## Step-by-Step Execution

### Step 1: TypeScript Type-Check

```bash
pnpm turbo run type-check
```

Checks TypeScript compilation across all apps.

- **Pass**: Exit code 0, zero errors
- **Fail**: Fix all type errors before proceeding

### Step 2: ESLint

```bash
pnpm turbo run lint
```

Checks ESLint violations across all apps.

- **Pass**: Exit code 0, no errors/warnings
- **Fail**: Fix lint issues or add `// eslint-disable-next-line` with justification

### Step 3: Backend Tests

```bash
cd apps/backend && uv run pytest -x -q --tb=short
```

Runs pytest with fail-fast mode.

- **Pass**: Exit code 0, all tests pass
- **Fail**: Fix failing tests before marking task complete

---

## Expected Output Format

```
## Quality Gate Result
- TypeScript:     PASS / FAIL (N errors)
- ESLint:         PASS / FAIL (N warnings)
- Backend tests:  PASS / FAIL (N failures)
- Overall:        READY TO COMMIT / FIX REQUIRED
```

---

## Minions Rule: <= 2 CI Rounds

Per the Stripe Minions framework, every task must pass quality gates within 2 attempts:

- **Round 1**: Initial implementation → run `/quality-gate`
- **Round 2** (if needed): Fix identified issues → run `/quality-gate` again
- **Escalate if still failing**: Do NOT attempt Round 3 — report to user

This discipline enforces correctness-first development and prevents "fix-loop" spirals.

---

## Common Failure Causes

| Failure                             | Likely Cause                     | Fix                                        |
| ----------------------------------- | -------------------------------- | ------------------------------------------ |
| TS: Cannot find module              | Missing import or wrong path     | Check import, verify file exists           |
| TS: Property does not exist         | Wrong type or API response shape | Align type with Pydantic model             |
| TS: Type 'X' not assignable         | Type mismatch                    | Add explicit type cast or fix upstream     |
| ESLint: no-unused-vars              | Variable declared but not used   | Remove or use the variable                 |
| ESLint: react-hooks/exhaustive-deps | Missing useEffect dependency     | Add dependency or extract with useCallback |
| Pytest: ImportError                 | Missing dep or wrong module path | Check `uv sync`, verify import path        |
| Pytest: 422 Unprocessable           | Pydantic validation failed       | Check request body matches schema          |
| Pytest: 404 Not Found               | Route not registered             | Check router registered in main.py         |

---

## When to Run

**MANDATORY**:

- Before marking any task as complete
- Before creating a PR
- After fixing any error (to verify the fix didn't break something else)

**Recommended**:

- After modifying any file (quick incremental check)
- Before deploying to production

---

## Related Commands

- `/toolshed <task>` — Run BEFORE implementation to assemble context
- `/test` — Full test suite (slower, includes integration tests)
- `/health-check-10x` — Full system health check (post-sprint)
