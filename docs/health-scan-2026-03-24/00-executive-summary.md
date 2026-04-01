# CCW-ERP-CRM System Health Audit — Executive Summary

**Audit Date**: 2026-03-24
**Scope**: 8 domain audits — Backend, Frontend, Database, Integrations, DevOps, Security, Performance, Testing
**Audited By**: Domain specialists (15+ years experience each)

---

## 1. Overall System Health Score

| Metric | Value |
|--------|-------|
| Composite Score | **82.0 / 100** |
| Letter Grade | **B** |
| Domains in A range (≥90) | 0 |
| Domains in B range (75–89) | 6 |
| Domains in C range (60–74) | 2 |
| Critical (P0) issues | 5 |
| High (P1) issues | 18 |
| Medium (P2) issues | 21 |

---

## 2. Executive Overview

CCW-ERP-CRM is a well-structured full-stack ERP/CRM in active production deployment. The codebase demonstrates genuine engineering discipline in its strengths: 100% timezone-aware database models, HMAC timing-safe webhook verification across all active webhooks, zero SQL injection vectors, zero hardcoded production credentials, and solid async architecture using httpx and FastAPI throughout. However, the system carries a cluster of systemic gaps that, taken together, represent meaningful risk to production reliability and developer velocity. The two most urgent concerns are a CI pipeline that allows broken backend code to pass unblocked (via `continue-on-error: true` on the pytest step) and an authentication bypass path where any HTTP client can impersonate any user by supplying a bare `X-User-Id` header without a valid JWT. Secondary concerns include 9 dashboard cache decorators that have been disabled due to an unresolved Pydantic serialisation bug (leaving the highest-traffic page uncached), 211 broad `except Exception` handlers that swallow error context, and a testing layer where the backend coverage gate is non-blocking and frontend page-level behavior tests cover only 11% of pages. None of these individually threaten the deployed system today, but collectively they create compounding risk as the system grows.

---

## 3. Top 5 Critical Findings (Cross-Domain)

| # | Finding | Domain(s) | Risk |
|---|---------|-----------|------|
| 1 | **Authentication bypass via `X-User-Id` header** — any unauthenticated client can impersonate any known user ID without a JWT | Security | Data exposure, privilege escalation |
| 2 | **CI test gate is non-blocking** — `continue-on-error: true` on the pytest step means broken backend code passes CI and merges to `main` | DevOps, Testing | Financial regressions ship to production silently |
| 3 | **Dashboard cache entirely disabled** (9 endpoints) — Pydantic serialisation bug forces every dashboard load to hit the DB with raw aggregation queries | Performance | Latency and DB load spike under any traffic |
| 4 | **211 broad `except Exception` handlers** across 121 route files, many with no logging — errors are swallowed silently | Backend | Silent failures, undetectable data corruption |
| 5 | **7 test files are untracked in git** — `test_billing.py`, `test_approvals_batch_2c.py`, `test_workflows_batch_2c.py`, `test_gap_batch_2b*.py`, `test_batch_2c_structure.py` never run in CI | Testing | Financial and workflow tests invisible to CI gates |

---

## 4. Health Score by Domain

| Domain | Score | Grade | Key Finding |
|--------|-------|-------|-------------|
| Backend Architecture | 85/100 | B+ | 211 broad exception handlers; 23 sync functions in async routes; 100+ mypy violations |
| Frontend Architecture | 87/100 | B+ | 11 raw `fetch()` files bypassing typed client; 0 route-level `error.tsx` or `loading.tsx`; 65 silent catch blocks |
| Database | 82/100 | B | Mixed SQLAlchemy 1.x/2.0 style (57% legacy); 50 FKs without `ondelete`; 38 JSON→JSONB columns outstanding |
| Integrations | 81/100 | B | No 429 rate-limit handling on any integration; retry logic on only 2 of 7 integrations; no circuit breaker |
| DevOps / CI-CD | 61/100 | C+ | Non-blocking CI gates; mypy commented out; 3 third-party actions on floating `@master`; node-exporter missing from compose |
| Security | 86/100 | B+ | `X-User-Id` auth bypass (HIGH); Swagger UI publicly accessible in production; `productionBrowserSourceMaps: true` exposes source |
| Performance | 86/100 | B+ | Dashboard cache disabled (all 9 endpoints); N+1 in approvals (51 queries/page); no trigram indexes for ILIKE search |
| Testing | 70/100 | C+ | Backend test gate non-blocking; 40% route coverage; frontend page-level test coverage 11%; 7 untracked test files |

**Composite average**: (85+87+82+81+61+86+86+70) / 8 = **82.3 / 100 → Grade: B**

---

## 5. Priority Remediation Roadmap

### Sprint 1 — Critical P0 (Estimated: 2 weeks)

| ID | Task | Domain | Effort |
|----|------|--------|--------|
| P0-1 | Remove `X-User-Id` header auth bypass in `auth.py:96-100` | Security | 1h |
| P0-2 | Remove `continue-on-error: true` from pytest CI step; add `backend-tests` to the `ci-summary` fail gate | DevOps | 2h |
| P0-3 | Fix Pydantic serialisation bug on dashboard cache decorators (use `.model_dump(mode="json")` before caching); re-enable all 9 `@cached` decorators in `demo_dashboard.py` | Performance | 1 day |
| P0-4 | Commit 7 untracked test files to git so they run in CI | Testing | 1h |
| P0-5 | Set `productionBrowserSourceMaps: false` in `next.config.ts` | Security | 15 min |
| P0-6 | Add `validate_production_secrets()` call to `main.py` lifespan startup | Security | 2h |
| P0-7 | Add root `error.tsx` + `(dashboard)/error.tsx`; migrate 11 raw `fetch()` files to typed `apiClient` | Frontend | 3 days |
| P0-8 | Disable Swagger `/docs` in production (`docs_url=None if settings.is_production`) | Security | 30 min |
| P0-9 | Add 50 missing FK `ondelete` rules (audit `ap2_models.py`, `cin7_gl_models.py`, `container_models.py`) | Database | 2 days |
| P0-10 | Convert 23 synchronous route functions to `async def`; fix blocking I/O in `ai/chat.py`, `xero.py`, `pos_xero_reconciliation.py` | Backend | 2 days |

### Sprint 2 — High P1 (Estimated: 2 weeks)

| ID | Task | Domain | Effort |
|----|------|--------|--------|
| P1-1 | Fix N+1 in `approvals.py` list/pending (use `selectinload` or `IN` query) | Performance | 1 day |
| P1-2 | Add retry + exponential backoff to Xero, AP2, SendGrid integrations | Integrations | 2 days |
| P1-3 | Add idempotency check (webhook_event_id) to bank feeds and AP2 webhooks | Integrations | 1 day |
| P1-4 | Add 429 `Retry-After` rate-limit handling to all 7 integrations | Integrations | 2 days |
| P1-5 | Raise backend coverage threshold to 60% and make it blocking | DevOps, Testing | 1 day |
| P1-6 | Add frontend `vitest.config.ts` coverage thresholds (60% minimum) | Testing | 2h |
| P1-7 | Pin third-party CI actions to commit SHAs (`snyk/actions`, `trivy-action`) | DevOps | 2h |
| P1-8 | Migrate 38 JSON → JSONB columns in `shopify_models.py`, `email_models.py`, `xero_models.py` | Database | 2 days |
| P1-9 | Fix 100+ mypy violations; enable mypy in CI (non-strict initially) | Backend | 3 days |
| P1-10 | Add node-exporter to `docker-compose.yml` to fix broken Prometheus scrape target | DevOps | 1h |
| P1-11 | Add API-level tests for workshop routes (5 files), `invoice_payments.py`, monitoring sub-routes | Testing | 3 days |
| P1-12 | Protect Prometheus `/metrics` endpoint with IP allowlist or token auth | Security | 1 day |

### Sprint 3 — Medium P2 (Estimated: 2 weeks)

| ID | Task | Domain | Effort |
|----|------|--------|--------|
| P2-1 | Add trigram (pg_trgm GIN) indexes for ILIKE search on `products.name`, `products.sku`, `customers.company_name` | Performance | 1 day |
| P2-2 | Implement circuit breaker for Cin7, Xero, Shopify integrations | Integrations | 2 days |
| P2-3 | Create `apps/web/app/(dashboard)/loading.tsx` and route-specific loading files for orders, inventory, reports, POS | Frontend | 1 day |
| P2-4 | Add 4 missing composite indexes: workflow_instances, notifications, cin7_sync_logs, inventory stock | Database | 1 day |
| P2-5 | Add E2E Playwright tests for POS terminal, orders, customers, products (4 highest-traffic pages) | Testing | 3 days |
| P2-6 | Extract shared Zod schemas to `lib/schemas/`; create `useApiData<T>()` hook | Frontend | 2 days |
| P2-7 | Add startup validation for production-required env vars (`DATABASE_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, etc.) | DevOps | 1 day |
| P2-8 | Replace `python-jose` with `joserfc>=0.9.0` to eliminate CVE-2024-33664/33663 | Security | 1 day |
| P2-9 | Add bank feeds CSV export row limit (10,000 rows + warning); batch `process-onboarding-emails` cron | Performance | 1 day |
| P2-10 | Migrate 12 routes from deprecated `get_db` to `get_async_db`; remove `get_db` function | Backend | 1 day |

---

## 6. Key Metrics Across the System

| Category | Metric | Value |
|----------|--------|-------|
| **Codebase** | Backend route files | 121 |
| **Codebase** | API endpoints (approx.) | ~640 |
| **Codebase** | Frontend pages (`page.tsx`) | 83 |
| **Codebase** | Shared frontend components | 107 |
| **Codebase** | Integration files | 60 across 12 integrations |
| **Codebase** | Database model files | 42 |
| **Database** | DateTime columns (all tz-aware) | 388 / 388 (100%) |
| **Database** | FKs with explicit `ondelete` | 116 / 166 (70%) |
| **Database** | SQLAlchemy 2.0 `Mapped[]` style | 801 / 1,844 columns (43%) |
| **Security** | Hardcoded production credentials | 0 |
| **Security** | SQL injection vectors | 0 |
| **Security** | HMAC timing-safe webhook checks | 11 / 11 (100%) |
| **Performance** | Redis cache active (hot paths) | 8 endpoints active; 9 dashboard disabled |
| **Performance** | Core list endpoints N+1 free | 4 / 4 |
| **Performance** | Trigram search indexes | 0 / 4 needed |
| **Integrations** | Retry with backoff | 2 / 7 integrations |
| **Integrations** | 429 rate-limit handling | 0 / 7 integrations |
| **Integrations** | Demo/live mode coverage | 57 switch points (100%) |
| **Testing** | Backend test files | 142 |
| **Testing** | Backend test functions | 1,828 |
| **Testing** | Backend total assertions | 4,539 |
| **Testing** | Backend routes with API tests | ~48 / 121 (40%) |
| **Testing** | Frontend test files | 73 |
| **Testing** | Frontend page behavior tests | 8 / 76 pages (11%) |
| **Testing** | E2E specs (business flows) | 5 of ~70 page routes (7%) |
| **CI** | Backend test gate blocking | No (`continue-on-error: true`) |
| **CI** | Frontend coverage threshold | None defined |
| **CI** | Backend coverage threshold | 15% (non-blocking) |

---

## 7. Resource Investment Estimate

| Sprint | Focus | Engineering Effort | Outcome |
|--------|-------|-------------------|---------|
| Sprint 1 (Weeks 1–2) | Security fixes, CI gate, dashboard cache, untracked tests | 2 engineers × 2 weeks (40 person-days) | Authentication bypass closed; CI becomes reliable; dashboard load time drops significantly |
| Sprint 2 (Weeks 3–4) | N+1 fix, integration resilience, mypy, test coverage gates | 2 engineers × 2 weeks (40 person-days) | Approvals API stabilised; Xero/AP2/SendGrid retry-safe; CI now blocks on regressions |
| Sprint 3 (Weeks 5–6) | Search indexes, circuit breakers, loading UX, E2E expansion | 2 engineers × 2 weeks (40 person-days) | Production-scale search performance; core CRUD pages have E2E coverage |
| **Total** | | **~120 person-days** | System health target: **A- (90+)** |

**Note**: All P0 security fixes (authentication bypass, source maps, Swagger auth) can be completed in under one day by a single engineer and should be treated as out-of-sprint urgent items.

---

*Next audit scheduled: 2026-04-24. Re-run `docs/health-scan-*/` audits after Sprint 2 to measure remediation progress.*
