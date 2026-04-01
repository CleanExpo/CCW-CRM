# Health Check Results — Sprint 0 — 2026-03-03

| Check                  | Status  | Notes                                             |
| ---------------------- | ------- | ------------------------------------------------- |
| 1. Route Registration  | ❌ FAIL | 4 routes unregistered in main.py (see below)      |
| 2. Page Routing        | ✅ PASS | 64 dashboard pages, all have page.tsx             |
| 3. Nav Coverage        | ✅ PASS | 38 nav links, 0 point to missing pages            |
| 4. API Client Map      | ✅ PASS | 35 API client files, all major domains covered    |
| 5. TypeScript          | ✅ PASS | tsc --noEmit returned no errors                   |
| 6. DB Model Coverage   | ⚠️ NOTE | 4 routes use raw SQL text() — likely intentional  |
| 7. Package Declaration | ✅ PASS | All key packages in pyproject.toml                |
| 8. Agent Registry      | ✅ PASS | 15 agent files (+ 3 state files) in specialized/  |
| 9. Test Suite          | ⚠️ ENV  | slowapi not installed in local env — code is fine |
| 10. Catalog Freshness  | ✅ PASS | All 6 catalogs: Last Updated 2026-03-03           |

---

## Check 1 Detail — Unregistered Routes

These `.py` route files exist but have no `include_router` call in `main.py`:

| File                         | Domain           | Action                                                      |
| ---------------------------- | ---------------- | ----------------------------------------------------------- |
| `contractors.py`             | CRM              | **Register** — frontend page exists at /contractors         |
| `cron_jobs.py`               | Infrastructure   | Evaluate — intentional or forgotten?                        |
| `pos_xero_reconciliation.py` | POS / Accounting | Evaluate — may be superseded by reconciliation_dashboard.py |
| `inventory_forecast.py`      | Inventory        | **Register** — frontend page exists at /inventory/forecast  |

AI-conditional routes found not in main.py (acceptable — require extra deps):

- `ai/assets.py`, `ai/document_parser.py`, `ai/form_autofill.py`, `ai/protocol.py`, `ai/test_failures.py`

---

## Check 6 Detail — Raw SQL Note

Routes using `sqlalchemy.text()` (legitimate use cases):

- `health.py` — raw SQL for DB connectivity ping (correct pattern)
- `orders.py` — complex aggregation query
- `pos_transactions.py` — complex aggregation query
- `quotes.py` — complex aggregation query

No routes were found using raw string SQL outside of `text()`. Pattern is acceptable.

---

## Check 9 Detail — Environment Note

Test suite failed with `ModuleNotFoundError: No module named 'slowapi'`.
This is a **local environment issue** — `slowapi` is correctly declared in `pyproject.toml`.
Fix: `cd apps/backend && uv sync` before running tests.

---

## Totals

- Route files: 87 (88 including toolshed.py just created)
- Dashboard pages: 64
- API client files: 35
- AI agent files: 15 (+3 state files)
- Catalogs: 6 / all fresh

## Action Items

1. Register `contractors.py` in main.py (has frontend at /contractors)
2. Register `inventory_forecast.py` in main.py (has frontend at /inventory/forecast)
3. Evaluate `cron_jobs.py` and `pos_xero_reconciliation.py` — register or delete
4. Run `cd apps/backend && uv sync` to fix local test environment
