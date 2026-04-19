# Strict Typing — Burn-down Log 2026

Tracks strict-type error counts so the team can burn them down with
visible weekly progress.

- Frontend: `pnpm turbo run type-check --filter=web` with
  `apps/web/tsconfig.json → "strict": true`.
- Backend: `cd apps/backend && uv run mypy --strict src/api src/integrations src/ai`.

`pyproject.toml` currently keeps a broad `[[tool.mypy.overrides]]`
suppressor (`ignore_errors = true`) on the three hot paths so CI
still passes. The numbers below are measured WITHOUT that suppressor —
they represent the real debt to burn down before we can flip the
config.

---

## Baseline — Week of 2026-04-19 (UNI-1941)

| Target             |  Errors | Files | Checked |
| ------------------ | ------: | ----: | ------: |
| `apps/web` (TS)    |   **0** |     0 |     all |
| `src/api` (mypy)   | **164** |    30 |     155 |
| `src/integrations` |  **76** |    14 |      68 |
| `src/ai` (mypy)    |   **2** |     1 |      67 |
| **Backend total**  | **242** |    45 |     290 |

### Top error categories (backend)

From a sample of the error stream:

- `no-untyped-call` — calls into untyped legacy helpers (`AP2DemoClient`, `SecretsManager`, `_get_collector`, etc.). Largest single bucket.
- `type-arg` — bare `dict` / `list` without parameter types (e.g. `dict` not `dict[str, Any]`).
- `no-untyped-def` — functions missing signatures; many return-type `-> None` hints.
- `return-value` — functions annotated to return a value but paths return `None`.
- `assignment` — `T | None` assigned to `T` without narrowing.

### Observations

- **`src/ai` is within reach.** Only 2 errors in 1 file (`src/integrations/secrets_manager.py` — yes, the `ai` path imports it). Flipping strict on `src/ai` is a 30-min task.
- **`src/integrations` is mid-sized.** 76 errors across 14 files — one burn-down sprint.
- **`src/api` dominates.** 164 errors across 30 files. Likely to need several focused sessions.

---

## Burn-down plan

1. **Immediate (this sprint):** close the 2 errors in `src/ai`. Add a `[[tool.mypy.overrides]]` block that pins `strict = true` + `ignore_errors = false` for `src.ai.*` only. Wire into CI.
2. **Next sprint:** knock down `src/integrations` to <25 errors, then flip strict for that path.
3. **Sprint +2:** target `src/api` in 30-error increments.

Owner: backend specialist. Cadence: one row added to this doc per week.
Target date for all three paths strict-clean: **end of Q2 2026**.

---

## Weekly log format

Append one row per week:

```
## Week of YYYY-MM-DD

| Target             | Errors | Δ from prior week | Notes |
| ------------------ | -----: | ----------------: | ----- |
| apps/web (TS)      |      N |              ±M   |       |
| src/api (mypy)     |      N |              ±M   |       |
| src/integrations   |      N |              ±M   |       |
| src/ai (mypy)      |      N |              ±M   |       |
```

Generate with:

```bash
pnpm turbo run type-check --filter=web 2>&1 | grep -cE "error TS" || echo 0
cd apps/backend
uv run mypy --strict src/api         2>&1 | tail -1
uv run mypy --strict src/integrations 2>&1 | tail -1
uv run mypy --strict src/ai           2>&1 | tail -1
```

---

_Last updated: 2026-04-19 (baseline — UNI-1941)_
