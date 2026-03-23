# Testing Engineer Health Audit

**Audit Date**: 2026-03-24
**Auditor**: Senior Testing Engineer (15+ years experience)
**Scope**: Unit tests, integration tests, E2E tests, coverage gaps

---

## Executive Summary

**Overall Grade: C+ (adequate volume, critical structural weaknesses)**

The codebase has an impressive raw test count — 142 backend Python test files, 73 frontend test files, 7 Playwright specs — but the quality, coverage distribution, and CI enforcement have serious gaps that undermine the safety net the numbers suggest.

**Key findings:**

1. **Backend CI test gate is non-blocking** (`continue-on-error: true` on the pytest step). Tests can fail in CI and the build still succeeds. The only hard gate is a 15% `--cov-fail-under` threshold — essentially a floor that any non-trivial codebase passes by accident.

2. **73 of ~121 backend route modules have no dedicated API-level test**. Workshop (5 routes), most AI routes (16+), and all monitoring sub-routes are completely untested at the API level.

3. **Frontend tests are almost entirely API client shim tests**, not component or page-level behavior tests. The 73 test files include ~50 files that just assert an `apiClient.get/post` is called with the right URL. No rendered UI assertions for 80%+ of pages.

4. **E2E coverage is dangerously thin**: 5 business-flow specs cover invoices, reconciliation, workflows, approvals, and error-handling. The POS, inventory, orders, customers, products, purchase orders, warehouse, workshop, and all settings pages have zero E2E coverage.

5. **Integration test suite (576 assertions across `tests/integration/`) is the strongest layer** — particularly Cin7 sync, CRM, and protocol tests — but covers only 10 of the 20+ integration routes.

**Estimated actual coverage rates:**
- Backend routes with any test: ~40% (48 / 121 route files)
- Frontend pages with meaningful behavior tests: ~12% (10 / 76 pages)
- E2E flows covered: ~7% (5 of ~70 distinct page routes)

---

## 1. Backend Test Coverage

### Test File Inventory

**Total test files**: 142 Python files across the following subdirectories:

| Directory | Files | Purpose |
|---|---|---|
| `tests/api/` | 25 | API endpoint HTTP tests |
| `tests/integration/` | 19 | Cin7, AP2, Xero, Shopify, protocol |
| `tests/services/` | 14 | Pure service-layer unit tests |
| `tests/security/` | 4 | Auth, injection, XSS/CSRF, encryption |
| `tests/load/` | 12 | Locust load test scenarios |
| `tests/smoke/` | 1 | Broad endpoint smoke sweep |
| `tests/e2e/` | 2 | Login flow, order flow |
| `tests/unit/` | 2 | Number generation, reconciliation logic |
| `tests/` (root) | 27 | Mixed gap-remediation, batch tests, agent tests |
| `tests/fixtures/` | 4 | Shared data fixtures |
| `tests/integrations/` | 1 | Xero token manager |
| `tests/utils/` | 1 | Calculation utilities |
| `tests/webhooks/` | 1 | Webhook transactions |
| `tests/performance/` | 0 | Empty directory |

**Total test functions (`def test_*`)**: 1,828
**Total assert statements**: 4,539

### Routes Tested vs. Untested

**Tested at API level** (explicit `TestClient`/`AsyncClient` HTTP calls):
- `approvals`, `bank_feeds`, `billing`, `customer_orders`, `orders`, `products`, `customers`, `quotes`, `translations`, `pos_transactions`, `reconciliation`, `workflows`, `invoices` (tax), `purchase_orders`, `inventory`, `health`, `approvals_integration`, `workflows_integration`

**Untested at API level** (no HTTP-level test exists):
- `activities`, `agents_monitor`, `analytics`, `autonomous_dev`, `autonomy_metrics`, `backorders`, `chat`, `config`, `contacts`, `containers`, `contractors`, `crm_health`, `crm_onboarding`, `crm_personas`, `cron_jobs`, `dashboard_stream`, `email_audit`, `google_ai`, `inventory_stream`, `invoice_payments`, `jobs`, `monitoring/*` (4 sub-routes), `notifications`, `prd`, `public_stats`, `reconciliation_dashboard`, `search`, `service_requests`, `settings`, `shipments`, `sla`, `suppliers`, `team`, `warehouse`, `webhooks`

**Workshop routes**: All 5 route modules (`bookings.py`, `dashboard.py`, `equipment.py`, `reminders.py`, `templates.py`) have zero test files.

**AI routes coverage**: Of 20 AI route files, approximately 8 have tests (`approval_gates`, `build_command`, `command_parser`, `gap_sync`, `requirement_verification`, `project_intelligence`, `prometheus_metrics`, `toolshed`). The remaining 12 (`anomaly`, `assets`, `chat`, `cin7_anomaly`, `cin7_forecast`, `cin7_shadow_ai`, `document_parser`, `form_autofill`, `generate`, `insights`, `inventory_forecast`, `learning`, `marketing_ai`, `specialized`, `staff_copilot`, `supervisor`) are untested.

**Integration sub-routes**: `cin7_bom`, `cin7_fulfilment`, `cin7_gl`, `cin7_grn`, `cin7_inventory_writeback`, `cin7_line_items`, `cin7_shadow_sync`, `cin7_webhook_subscriptions`, `elevenlabs`, `shopify_theme` have no tests.

### Test Quality Assessment (Backend)

**Strengths:**
- Integration test layer for Cin7 uses realistic mock data matching live API shapes
- Tax calculator service tests (`test_tax_calculator.py`) are exemplary: pure function testing, decimal-accurate assertions, full jurisdiction matrix (AU, CA-BC, CA-ON, CA-NS, CA-QC)
- Security tests cover password non-exposure, brute force patterns, and injection attacks
- Billing tests use DB fixtures with real model instances, not just mock HTTP
- Gap-remediation tests follow a clear pattern: endpoint → status code → response shape → field validation

**Weaknesses:**
- Many `tests/api/` files test only 200-path responses; error paths (422, 404, 403) are covered in only 3 dedicated files (`test_quote_404_errors.py`, `test_quote_422_errors.py`, `test_500_errors.py`)
- Load tests (`locustfile.py`) require Locust and cannot run in standard pytest; they are effectively documentation, not CI gates
- `tests/e2e/test_login_flow.py` and `test_order_flow.py` are backend Python files, not browser E2E tests — they test HTTP flows, not the actual UI
- Several `test_gap_batch_2b.py` / `test_batch_2c_structure.py` files are untracked (git status shows `??`) and have not been committed — these assertions are invisible to CI
- `continue-on-error: true` on the pytest CI step means test failures do not block merges

---

## 2. Frontend Test Coverage

### Test File Inventory

**Total test files**: 73 (in `apps/web/__tests__/`)
**Total `it`/`test` blocks**: ~672

| Directory | Files | Coverage Type |
|---|---|---|
| `__tests__/lib/api/` | 57 | API client method tests |
| `__tests__/lib/types/` | 4 | Type/interface validation |
| `__tests__/lib/` | 2 | Marketplace utils, CSV export |
| `__tests__/app/` | 8 | Page-level render/integration |
| `__tests__/components/` | 6 | Component render tests |

### Coverage Distribution Problem

The heavy concentration in `lib/api/` (57 of 73 files = 78%) means the test suite validates that API client methods call the right URLs with the right parameters — **but does not test what the UI renders, how it handles errors, or how users interact with it**.

**Page-level tests** (render + assert visible UI): Only 8 files out of 76 pages:
- `approvals-page.test.tsx`
- `billing-page.test.tsx`
- `orders-integration.test.tsx`
- `quotes-integration.test.tsx`
- `reconciliation-page.test.tsx`
- `workflows-page.test.tsx`
- `portal/service.test.tsx`
- `portal/walk-in.test.tsx`

Of these, `service.test.tsx` and `walk-in.test.tsx` have **pre-existing failures** (documented in project memory). The page-level tests that do pass test simplified stub components rather than the actual `page.tsx` implementations.

**Pages with NO test of any kind** (not even an API client test):
- `ai-assistant`, `alerts`, `autonomous`, `autonomous-dev`, `bank-feeds`, `containers`, `contractors`, `demo`, `demo-live`, `emails`, `faq`, `insights`, `inventory/bom`, `inventory/forecast`, `inventory/reservations`, `inventory/transfers`, `marketing`, `monitoring`, `prd`, `reports`, `settings/*` (most sub-pages), `submissions`

### Frontend Test Quality Assessment

**Strengths:**
- API client tests use `vi.mock` correctly and test query string construction precisely
- `csv-export.test.ts` tests pure utility functions with edge cases
- Type tests validate that TypeScript interfaces match expected shapes
- `EmptyState.test.tsx` and `ErrorBoundary.test.tsx` test reusable UI components

**Weaknesses:**
- Page-level tests render simplified stub components, not the actual page file — they cannot catch regressions in the real `page.tsx` implementations
- No tests for form validation behavior (invalid inputs, required field errors)
- No tests for loading states, error toasts, or optimistic UI patterns
- No tests for table sorting, filtering, or pagination interactions
- No tests for modal open/close, delete confirmation dialogs
- `vitest.config.ts` has **no `thresholds` block** — coverage can drop to 0% with no CI failure

---

## 3. E2E Test Coverage

### E2E Spec Inventory

**Total specs**: 7 files (5 business-flow + 1 accessibility + 1 visual)

| File | Pages Covered | Test Count (approx) |
|---|---|---|
| `e2e/invoices.spec.ts` | `/invoices` | ~5 |
| `e2e/reconciliation.spec.ts` | `/reconciliation`, `/pos/reconciliation` | ~4 |
| `e2e/workflows.spec.ts` | `/workflows` | ~4 |
| `e2e/approvals.spec.ts` | `/approvals` | ~3 |
| `e2e/error-handling.spec.ts` | Multiple (error states) | ~6 |
| `tests/accessibility/a11y.spec.ts` | `/`, `/prd`, auth pages | ~4 |
| `tests/visual/components.visual.spec.ts` | Visual regression | ~varies |

**Total E2E test functions**: ~96 (across all 7 spec files)

### High-Risk Pages With Zero E2E Coverage

These pages handle financial transactions or data mutations with no browser-level test:

- **POS** (`/pos`, `/pos/terminal`, `/pos/locations`, `/pos/staff`) — cash register operations, no E2E
- **Orders** (`/orders`, `/orders/fulfilment`) — order creation and status changes, no E2E
- **Products** (`/products`, `/products/[id]`) — core catalog, no E2E
- **Customers** (`/customers`, `/customers/[id]`, `/customers/health`) — CRM core, no E2E
- **Purchase Orders** (`/purchase-orders`, `/purchase-orders/receiving`) — procurement, no E2E
- **Inventory** (`/inventory`, `/inventory/stock`, `/inventory/transfers`) — stock management, no E2E
- **Warehouse** (`/warehouse`) — operations hub, no E2E
- **Workshop** (all 6 pages) — service management, no E2E
- **Bank Feeds** (`/bank-feeds`) — financial imports, no E2E
- **Settings / Integrations** — Cin7/Xero/Shopify connection flows, no E2E
- **Login / Auth** — login form submission not tested by Playwright (only by backend Python test)

### E2E Test Quality Assessment

The existing E2E tests show mature defensive patterns:
- They use `if (await element.isVisible())` guards before interactions, preventing false failures in demo-mode environments where UI state may differ
- `invoices.spec.ts` tests the full tax calculation flow end-to-end (login → navigate → create invoice → add line item → calculate tax → verify display)
- `error-handling.spec.ts` tests network failure states and recovery

However, the defensive guards can mask actual regressions — if a button is missing entirely, the test skips rather than fails.

---

## 4. Test Quality Assessment

### What the Tests Are Doing Well

| Area | Assessment |
|---|---|
| Tax calculation (service) | Excellent: decimal precision, multi-jurisdiction, edge cases |
| Cin7 integration | Good: demo client, live routing, pagination, error handling |
| Security tests | Good: auth bypass, injection, XSS patterns tested |
| API contract tests | Adequate: status codes, response shape, pagination params |
| Load tests | Structural: Locust files exist but never run in CI |

### What the Tests Are NOT Doing

| Gap | Risk |
|---|---|
| No tests for workshop, contractor, container routes | Silent breakage undetected |
| No UI behavior tests (forms, validation, modals) | UX regressions undetected |
| No auth flow E2E (login → protected page → logout) | Security regression undetected |
| No concurrent write tests | Race condition bugs undetected |
| Billing tests not using real DB seeding | Mock-only, not catching schema mismatches |
| 7 untracked test files not in git | Lost on checkout, not in CI |

### Mock Usage Assessment

Backend: Appropriate use of `TestClient` for synchronous tests and `AsyncClient` for async DB tests. The `test_billing.py` uses real SQLAlchemy sessions with fixtures, which is the correct pattern. However, some newer batch tests mock at too high a level (e.g., mocking the entire route handler rather than the DB layer), reducing confidence.

Frontend: `vi.mock('@/lib/api/client')` is used correctly and consistently. The problem is not mock quality but test scope — mocking at the HTTP boundary means no component behavior is exercised.

---

## 5. Coverage Gaps (High-Risk Areas)

### CRITICAL — Financial/Payment Routes With No Tests

| Route | Risk | Current Test Status |
|---|---|---|
| `POST /api/billing/payment-methods` | Payment data storage | Tested (billing.py) |
| `POST /api/invoice-payments/*` | Payment recording | **NO TEST** |
| `POST /api/pos-transactions/*` | POS cash handling | Partial (terminals only) |
| `POST /api/reconciliation/auto-match` | Financial reconciliation | Reconciliation integration test exists |
| `GET /api/bank-feeds/*` | Bank statement import | **NO TEST** |

### HIGH — Core CRUD Routes With No Tests

| Route Module | HTTP Methods Untested |
|---|---|
| `contacts.py` | GET list, GET detail, POST, PUT, DELETE |
| `contractors.py` | All |
| `containers.py` | All |
| `suppliers.py` | All |
| `service_requests.py` | All |
| `shipments.py` | All |
| `warehouse.py` | GET /api/warehouse/ops only has a basic test |

### HIGH — Workshop System (Entirely Untested)

The entire workshop management system (6 models, 5 route modules, 6 frontend pages) has zero backend tests. This includes `equipment.py`, `bookings.py`, `reminders.py`, `templates.py`, `dashboard.py`. The `workshop_scheduler.py` service (dual-interval scheduler, GRN logic) has no unit tests.

### HIGH — Frontend Pages With No Tests

Pages that perform mutations (create/edit/delete) with no test of any kind:
- `/pos/terminal` — live transaction processing
- `/orders/fulfilment` — order state transitions
- `/purchase-orders/receiving` — GRN receiving workflow
- `/invoices/[id]` — invoice print/payment
- `/bank-feeds` — financial data import
- `/settings/integrations/*` — connection state management

### MEDIUM — CI Coverage Threshold Is Effectively a Non-Gate

The backend pytest step runs with `--cov-fail-under=15`. With 142 test files and 1,828 test functions touching dozens of modules, the real coverage is certainly above 15%. This threshold cannot catch coverage degradation unless a catastrophic removal of tests occurs. A threshold of 60-70% would be appropriate.

The frontend has **no coverage threshold at all** in `vitest.config.ts`. No `thresholds` block means coverage can drop to zero with no CI signal.

---

## 6. CI Test Enforcement

### CI Pipeline Structure

```
backend-tests  →  frontend-tests  →  build
                                          ↓
                                    e2e-tests  →  accessibility-tests
                                          ↓
                                    ci-summary (fail if any failure)
```

### Coverage Gate Analysis

| Check | Configured | Blocks Merge? | Assessment |
|---|---|---|---|
| Backend linting (ruff) | Yes | Yes | Effective |
| Backend type check (mypy) | Commented out | No | Gap |
| Backend test coverage | `--cov-fail-under=15` | **No** (`continue-on-error: true`) | Critical gap |
| Frontend linting (ESLint) | Yes | Yes | Effective |
| Frontend type check | Yes | Yes | Effective |
| Frontend test coverage | No threshold | No | Critical gap |
| E2E tests | Run on every push | Yes (part of summary gate) | Good |
| Accessibility tests | Run on frontend-tests success | No (excluded from fail gate in summary) | Gap |

### Critical Finding: Backend Test Gate is Non-Blocking

Line 106 in `ci.yml`:
```yaml
continue-on-error: true
run: uv run pytest --cov=src --cov-report=xml --cov-report=term-missing --cov-fail-under=15 -v
```

The comment explains this was intentional ("pre-existing test failures tracked in UNI-1242"), but it means the entire backend test suite is advisory only. Any backend test failure — including a regression breaking a financial calculation — will not block a merge to `main`.

The `ci-summary` job at line 527 gates on `backend-tests.result == 'failure'`, but because `continue-on-error: true` is set on the pytest step, the `backend-tests` job outcome is `success` regardless of whether tests pass or fail. The gate is structurally bypassed.

### Missing CI Checks

- No `mypy` type checking (commented out with "enable when mypy errors are fixed")
- No contract/schema validation tests
- No backend coverage threshold that would actually fail the job
- No Playwright tests for login flow or core CRUD operations
- No dependency vulnerability scanning (no `pip audit` or `pnpm audit` step)

---

## Summary of Issues by Priority

### CRITICAL

| ID | Issue | Impact |
|---|---|---|
| T-001 | Backend pytest step has `continue-on-error: true` — test failures do not block merges | Financial regressions can ship to production |
| T-002 | 7 test files are untracked (not in git) — `test_gap_batch_2b.py`, `test_batch_2c_structure.py`, `test_billing.py`, `test_approvals_batch_2c.py`, `test_gap_batch_2b_smoke.py`, `test_workflows_batch_2c.py` | These assertions do not run in CI |
| T-003 | No frontend coverage threshold in `vitest.config.ts` | Frontend coverage can drop to 0% with no CI signal |

### HIGH

| ID | Issue | Impact |
|---|---|---|
| T-004 | Workshop system (5 backend routes, 6 frontend pages) has zero tests | Silent breakage after any refactor |
| T-005 | `invoice_payments.py` route has no tests — handles payment recording | Financial data integrity risk |
| T-006 | All monitoring sub-routes (`alerts.py`, `business_metrics.py`, `infrastructure.py`, `performance.py`) untested | Alerting failures go undetected |
| T-007 | E2E coverage omits POS terminal, orders, customers, products — the 4 highest-traffic pages | Core CRUD regressions undetected until users report them |
| T-008 | Backend mypy type checking is commented out in CI | Type errors ship silently |
| T-009 | 40+ backend routes have zero API-level tests | ~60% of API surface area unverified |

### MEDIUM

| ID | Issue | Impact |
|---|---|---|
| T-010 | Frontend tests are 78% API client shim tests, not component behavior tests | UI regressions (form validation, loading states, modals) not caught |
| T-011 | Backend coverage threshold (`--cov-fail-under=15`) is functionally meaningless | Does not detect degradation |
| T-012 | `service_requests.py`, `contractors.py`, `contacts.py`, `suppliers.py` — all have zero tests | CRUD regressions undetected |
| T-013 | AI route tests cover only 8 of 20 AI endpoints | AI agent failures not detected |
| T-014 | E2E defensive guards (`if await element.isVisible()`) may silently skip broken UI flows | Regressions masked |
| T-015 | No integration tests for Cin7 BOM, GL, fulfilment, GRN, inventory writeback routes | Wave 2 integration risk |

### LOW

| ID | Issue | Impact |
|---|---|---|
| T-016 | Load tests (`locustfile.py`) are not wired into CI — manual only | Performance regressions not caught in CI |
| T-017 | Accessibility tests excluded from the merge gate | A11y regressions not blocked |
| T-018 | Backend e2e tests (`test_login_flow.py`, `test_order_flow.py`) test HTTP flows, not browser UI — naming is misleading | Confusion about what is actually tested |
| T-019 | No contract tests between frontend types and backend Pydantic models | API contract drift undetected |

---

## Metrics Dashboard

| Metric | Count | Notes |
|---|---|---|
| Backend test files | 142 | Including load, security, integration subdirs |
| Backend test functions | 1,828 | `def test_*` across all files |
| Backend total assertions | 4,539 | `assert` statements |
| Integration test assertions | 576 | In `tests/integration/` only |
| Backend routes | 121 | Includes `__init__.py` |
| Backend routes with API tests | ~48 | ~40% coverage |
| Frontend test files | 73 | All in `__tests__/` |
| Frontend test blocks | ~672 | `it()`/`test()` blocks |
| Frontend pages | ~76 | `page.tsx` files in `(dashboard)/` |
| Frontend pages with behavior tests | ~8 | ~11% coverage |
| E2E spec files | 5 | Excluding accessibility + visual |
| E2E test functions | ~27 | Business-flow tests only |
| Dashboard pages with E2E | 5 | invoices, reconciliation, workflows, approvals, errors |
| Dashboard pages without E2E | ~71 | ~93% uncovered |
| CI coverage threshold (backend) | 15% (non-blocking) | Effectively no gate |
| CI coverage threshold (frontend) | None | No threshold defined |
| Untracked test files (not in git) | 7 | Not in CI |

---

**Audit completed**: 2026-03-24
