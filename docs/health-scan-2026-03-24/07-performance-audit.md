# Performance Engineer Health Audit

**Audit Date**: 2026-03-24
**Auditor**: Senior Performance Engineer (15+ years experience)
**Scope**: N+1 queries, pagination, caching, database indexes, bundle optimization, unbounded queries, background jobs

---

## Executive Summary

**Overall Grade: B+ (Good, with targeted gaps)**

The CCW-ERP-CRM codebase demonstrates solid performance engineering discipline on the core demo/CRUD paths. The four primary list endpoints (products, customers, orders, quotes) are well-optimised: they use subquery-based JOINs to eliminate N+1 patterns, have Redis caching with 5-minute TTL, and enforce paginated responses with `page_size` capped at 100. The async engine is properly pooled for serverless, and three composite indexes cover the most frequent filter combinations.

The principal bottlenecks identified are:

1. **Confirmed N+1 in `approvals.py`** — for every approval returned by a paginated list, a separate `SELECT` is issued to fetch its steps. Up to 50 extra queries per page.
2. **13 genuinely unbounded `scalars().all()` calls** across secondary routes — no `LIMIT` guard on the query before `.all()` is called.
3. **All dashboard cache decorators are commented out** — `demo_dashboard.py` has 9 `@cached` decorators disabled due to a Pydantic serialisation issue, leaving the most-hit page uncached.
4. **No GIN / pg_trgm trigram indexes** — 45+ `ilike()` full-text search calls depend on sequential scans.
5. **No bundle analyser, no dynamic imports** — the Next.js frontend has no code-splitting strategy beyond the App Router's automatic per-page split; heavy dashboard pages ship synchronously.
6. **Source maps enabled in production browser bundles** — `productionBrowserSourceMaps: true` increases download size for end users.

---

## 1. N+1 Query Detection

### 1.1 Core CRUD Routes (demo_lists.py) — PASS

The four primary list endpoints are correctly written using a single JOIN query with a correlated subquery for aggregate counts:

- `list_orders`: builds an `item_count_subquery` grouped by `OrderItem.order_id`, then outer-joins it into the main `Order` + `Customer` query. **Zero extra queries per row.**
- `list_quotes`: identical pattern with `QuoteItem`. **Zero extra queries per row.**
- `list_products` / `list_customers`: no related data needed on the list view; simple paginated selects. **Zero extra queries per row.**

No `selectinload` or `joinedload` is used here — the manual subquery approach is intentional and effective.

### 1.2 Approvals Route (approvals.py) — FAIL (CONFIRMED N+1)

Three list endpoints in `approvals.py` exhibit a classic N+1 pattern:

**Affected functions**: `list_approvals` (line 213), `get_pending_approvals` (line 268), `pending_my_approval` (line 569)

**Pattern observed**:
```python
# Step 1: fetch page of approvals (1 query)
result = await db.execute(query)
approvals = result.scalars().all()

# Step 2: for EACH approval, issue a separate query for steps (N queries)
for approval in approvals:
    steps_result = await db.execute(
        select(ApprovalStep).where(ApprovalStep.approval_id == approval.id)...
    )
    steps = steps_result.scalars().all()
```

With `page_size=50` (the default), this produces **up to 51 database round-trips per list request**. The `ApprovalStep` table should be loaded with `selectinload` or via a single `WHERE approval_id IN (...)` query.

### 1.3 Other Routes — PASS (with caveats)

- `backorders.py`: uses `selectinload` correctly for product, customer, container, and order associations.
- `activities.py`: uses `joinedload` on the single-record detail endpoint; list endpoints use `.limit(limit)` guards.
- `contacts.py`: paginated correctly; the `existing_primary` call (line 274) is a low-cardinality integrity check — acceptable.

**N+1 Risk Summary**:

| Route | Pattern | Queries per page (worst case) |
|---|---|---|
| `demo_lists.py` orders/quotes | Subquery JOIN | 2 (count + data) |
| `approvals.py` list/pending | Loop `await db.execute()` | 51 |
| `backorders.py` list | `selectinload` | 2 |
| `activities.py` list | `.limit()` + single query | 2 |

---

## 2. Pagination Coverage

### 2.1 Paginated Routes — Covered

All four core demo list endpoints enforce pagination via `Query` params:

```python
page: int = Query(1, ge=1)
page_size: int = Query(50, ge=1, le=100)
```

The cap of `le=100` is appropriate. `approvals.py`, `contacts.py`, `customers.py`, `products.py`, and `activities.py` all follow the same pattern with a `PaginatedResponse` wrapper returning `total`, `page`, `page_size`, `total_pages`, and `data`.

**Pagination is present on**: 284 `.limit()` occurrences counted across all backend route files.

### 2.2 Unpaginated Endpoints — Gap

Several secondary endpoints return unbounded result sets by design or omission:

- `GET /api/bank-feeds/accounts` — returns all active bank accounts with no limit (acceptable if bank account count is small, but no guard exists).
- `GET /api/bank-feeds/export` (line 596–599) — full table export with no limit, **this is a CSV export endpoint** and intentionally unbounded, but adds per-request load.
- `GET /api/cron/xero-token-health` (line 272–274) — fetches all `XeroConnection` rows, no limit. Low risk (small table), but pattern is concerning.
- `GET /api/contacts/{customer_id}` sub-resource endpoints — return full contact lists per customer. Bounded by customer relationship but uncapped.

### 2.3 Assessment

Core user-facing endpoints: well-paginated. Secondary/admin endpoints: inconsistent. The 151 `scalars().all()` occurrences across routes vs. 284 `.limit()` usages suggests roughly 50% of `.all()` calls have no upstream limit guard.

---

## 3. Caching Strategy

### 3.1 Redis Infrastructure — IMPLEMENTED

The caching stack is well-designed:

- `src/cache/redis_client.py`: `RedisCache` class with async connection pooling (`max_connections=20`), graceful degradation (no Redis = cache bypassed, not error), `socket_connect_timeout=5`, `socket_keepalive=True`.
- `src/cache/decorators.py`: `@cached(ttl, key_prefix)` decorator that hashes query params and kwargs into an MD5 fingerprint for cache key namespacing.
- Settings: `cache_enabled=True` by default, `cache_ttl=300`, `redis_host/port/db` all configurable.
- Startup lifecycle in `main.py`: connects on startup, disconnects on shutdown with proper error handling.
- Cache invalidation: `invalidate_cache(key_prefix)` utility exists for targeted invalidation.

### 3.2 Active Cache Coverage

| Endpoint | TTL | Status |
|---|---|---|
| `GET /api/demo/products` | 300s | Active |
| `GET /api/demo/customers` | 300s | Active |
| `GET /api/demo/orders` | 300s | Active |
| `GET /api/demo/quotes` | 300s | Active |
| `GET /api/products` (products.py) | 300s | Active |
| `GET /api/customers` (customers.py) | 300s | Active |
| `GET /api/contacts` | 300s | Active |
| `GET /api/activities` | 60s | Active |

### 3.3 Dashboard Cache — DISABLED (HIGH IMPACT)

**`demo_dashboard.py`** contains 9 `@cached` decorator invocations, all commented out. The comments explain the reason:

```python
# @cached(ttl=60, key_prefix="dashboard_aggregated")  # Disabled - Pydantic serialization issue
# @cached(ttl=60, key_prefix="dashboard_metrics")     # Disabled - cache interferes with auth
# @cached(ttl=300, key_prefix="dashboard_revenue")    # Temporarily disabled - caching issue with Pydantic models
```

The dashboard is the highest-traffic page. Every load runs raw aggregation queries against the database with no caching layer. The underlying issue (Pydantic model serialisation to JSON) is solvable (models need `.model_dump(mode="json")` before caching), but has not been resolved. **This is the highest-impact performance gap in the system.**

### 3.4 Missing Cache Coverage

Endpoints with no caching that would benefit from it:

- `GET /api/demo/dashboard/*` (all 9 aggregation endpoints)
- `GET /api/warehouse/ops`
- `GET /api/monitoring/alerts`
- `GET /api/approvals` (list — already N+1 impacted)

### 3.5 Cache Invalidation Coverage

Cache invalidation is only triggered manually via `invalidate_cache()`. There is no write-through or post-mutation invalidation on `POST`/`PUT`/`DELETE` routes observed in the audited files. If a product is updated via `PUT /api/products/{id}`, the `products:*` cache key will serve stale data for up to 5 minutes. For a CRM/ERP with real-time data expectations, this is an accepted trade-off but should be documented explicitly.

---

## 4. Index Utilization

### 4.1 Defined Composite Indexes — `indexes.py`

Three composite indexes are defined:

| Index Name | Columns | Use Case |
|---|---|---|
| `ix_order_items_order_product` | `order_id, product_id` | Line item JOIN queries |
| `ix_orders_customer_status` | `customer_id, status` | Customer order history filter |
| `ix_products_category_active` | `category, is_active` | Category browse of active items |

These address the three most common filter patterns on the core tables. The indexes are defined in a separate file from `demo_models.py` (which is locked), imported in `main.py`.

### 4.2 Index Gaps

**ILIKE / Full-text search — not indexed**: 45 `ilike()` calls were found across routes. Examples:

- `Product.name.ilike(f"%{search}%")` and `Product.sku.ilike(f"%{search}%")` — searches with a leading `%` cannot use B-tree indexes and require sequential scans.
- `Customer.company_name.ilike(...)`, `Customer.email.ilike(...)`, `Customer.customer_number.ilike(...)`

Without a `pg_trgm` GIN index, all search queries do full table scans. At current data volumes (demo scale) this is imperceptible, but at 10k+ products or customers it will degrade significantly.

**Recommended additions** (cannot be added without schema migration approval):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY ix_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY ix_products_sku_trgm ON products USING GIN (sku gin_trgm_ops);
CREATE INDEX CONCURRENTLY ix_customers_company_trgm ON customers USING GIN (company_name gin_trgm_ops);
```

**Foreign key indexes**: `orders.customer_id`, `order_items.order_id`, `quote_items.quote_id` — SQLAlchemy/Postgres does not auto-index FKs. These are covered by `ix_orders_customer_status` and `ix_order_items_order_product` for the join columns, but `quote_items.quote_id` has no composite coverage.

### 4.3 Assessment

Core indexes: adequate for current scale. Missing trigram indexes for LIKE search will become a bottleneck at production data volumes.

---

## 5. Bundle Optimization

### 5.1 Next.js Configuration Analysis (`next.config.ts`)

**Positive findings**:
- App Router in use — automatic per-route code splitting is enabled by default.
- `reactStrictMode: true` — helps catch rendering inefficiencies in development.
- Sentry configured with `disableLogger: true` (tree-shakes logger), `hideSourceMaps: true` (reduces client bundle).
- Images properly configured with `remotePatterns` (no wildcard `*` for `src`).
- CSP headers set.

**Negative findings**:

- **`productionBrowserSourceMaps: true`**: Source maps are generated and served to browsers in production. This increases the total download size for end users (source maps can be 2–5x the size of the minified bundle). For Sentry, source maps should be uploaded at build time and then either not served publicly or served from a CDN with access controls. This flag should be `false` unless there is an explicit requirement.
- **No bundle analyser configured**: There is no `@next/bundle-analyzer` integration. Bundle composition is opaque — large dependencies cannot be identified without a manual build analysis.
- **No dynamic imports found**: A search across `apps/web/app/` found zero uses of `next/dynamic` or React `lazy()`. Every component on every dashboard page is synchronously imported. For heavy pages (e.g. the warehouse page with its tabs, or the workflow builder), dynamic imports could defer JS for non-visible panels.
- **`typedRoutes: false`**: Not a performance issue, but worth noting as a type-safety gap.
- **`output: 'standalone'`**: Correct for Docker deployment. No impact on bundle size.

### 5.2 Server Component vs Client Component Balance

58 out of 76 dashboard pages declare `"use client"` at the top level. Only 28 Suspense / `loading.tsx` boundaries were found. The result is:

- Large client bundles shipped to the browser upfront.
- Minimal streaming / progressive loading.
- No Server Components fetching data server-side to reduce client-side waterfall.

The architecture matches a pre-App-Router SPA pattern, not the Next.js 15 streaming RSC pattern. This is a systemic concern — refactoring is significant but would yield meaningful LCP improvements on dashboard pages.

---

## 6. Unbounded Queries

### 6.1 Total Unbounded Calls

151 `.scalars().all()` calls found across route files. Of these, a significant subset have `.limit()` applied before `.all()` (either directly on the query or via pagination offset). The truly unbounded calls (no `.limit()` anywhere in the function scope) are:

**Critical (public-facing or high-volume tables)**:

| File | Line | Table | Notes |
|---|---|---|---|
| `bank_feeds.py` | 599 | `BankFeed` | CSV export — no limit, full table if date range not provided |
| `approvals.py` | 154, 310 | `ApprovalStep` | Per-approval step fetch in loops |
| `contacts.py` | 274 | `Contact` | Integrity check — low risk |
| `bank_feeds.py` | 226 | `BankAccount` | Dictionary-style lookup — low risk if table is small |
| `cron_jobs.py` | 274 | `XeroConnection` | Health check only — low risk |

**Lower risk (lookup / config tables)**:
- `analytics.py:71` — `meta_rows` from a metadata table
- `bank_feeds.py:101` — account sync, bounded by external API response
- `ai/chat.py:247, 320` — chat history, filtered by session ID

### 6.2 Highest Risk: Bank Feeds CSV Export

`GET /api/bank-feeds/export` (line 596–599) runs:

```python
query = query.order_by(BankFeed.transaction_date.desc())
# No .limit() applied
result = await db.execute(query)
feeds = result.scalars().all()
```

This fetches the entire `bank_feeds` table matching the filter criteria into memory before writing CSV. With a date range filter the risk is bounded, but without one (or with a year-long range), this could load thousands of rows into the application server's memory simultaneously. A streaming CSV approach or a hard limit (`LIMIT 10000`) with a warning would mitigate this.

---

## 7. Background Job Performance

### 7.1 Cron Job Architecture

Background work is handled via Vercel Cron HTTP endpoints (`/api/cron/*`) rather than a task queue. Findings:

| Job | Schedule | Pattern | Assessment |
|---|---|---|---|
| `check-expiring-quotes` | Daily 9am | Delegates to `notification_service` | GOOD — service encapsulation |
| `refresh-xero-tokens` | Every 15 min | Loop over expiring connections, `await token_manager._refresh_access_token()` | ACCEPTABLE — small N |
| `retry-failed-webhooks` | Every 5 min | `batch_size=50` cap, delegates to `webhook_service` | GOOD — bounded batch |
| `check-sla-breaches` | Every 15 min | Delegates to `sla_service` | GOOD — service layer |
| `process-onboarding-emails` | Daily 9am | `scalars().all()` on scheduled touchpoints, then loops | RISK — unbounded if many touchpoints accumulate |
| `refresh-health-scores` | Daily midnight | `classify_all_customers` — scans all customers | RISK — full table scan |

### 7.2 Notable Patterns

**Positive**:
- `retry-failed-webhooks` uses `batch_size=50` — prevents runaway processing.
- Dead letter queue access is limited via the `limit` parameter.
- Cron secret auth (`CRON_SECRET`) gates all endpoints.
- FastAPI `BackgroundTasks` is used in `prd.py` for non-blocking PRD generation — correct pattern.

**Negative**:
- `process-onboarding-emails`: loads **all** due touchpoints with `scalars().all()` and no batch limit. If onboarding emails accumulate (system offline for a day), one cron run could process thousands of records sequentially.
- `refresh-health-scores` → `classify_all_customers`: likely full-table customer scan. No batch size or cursor pagination.
- No distributed task queue (Celery, ARQ, Dramatiq). All background work is synchronous within the HTTP request lifecycle. A slow Xero token refresh or large email batch will hold the cron HTTP connection open for its full duration, with a risk of Vercel 60-second serverless timeout.
- `asyncio.create_task` is used in `health_monitor.py` and `autonomous_loop.py` for long-running monitoring loops — these are fire-and-forget tasks without cancellation guarantees on restart.

### 7.3 Pool Configuration

The async DB engine is configured for serverless:

```python
pool_size=5,     # 5 base connections
max_overflow=10  # up to 15 total
```

This is conservative and appropriate for Supabase's PgBouncer transaction-mode pooling (`statement_cache_size=0` confirms pgbouncer compatibility). The sync engine (`pool_size=20, max_overflow=30`) is used for migrations only.

---

## Summary of Issues by Priority

### CRITICAL

| ID | Issue | Location | Impact |
|---|---|---|---|
| P0-1 | Dashboard cache entirely disabled (9 endpoints) | `demo_dashboard.py` | Every dashboard load hits DB with aggregation queries |

### HIGH

| ID | Issue | Location | Impact |
|---|---|---|---|
| P1-1 | N+1 query in approvals list/pending (up to 51 queries/request) | `approvals.py:213, 268, 569` | Latency scales linearly with page size |
| P1-2 | No ILIKE trigram indexes — full table scans on search | `indexes.py` (missing) | O(n) search cost at production scale |
| P1-3 | `productionBrowserSourceMaps: true` increases user-facing JS payload | `next.config.ts:13` | Larger downloads for end users |

### MEDIUM

| ID | Issue | Location | Impact |
|---|---|---|---|
| P2-1 | Bank feeds CSV export — no row limit | `bank_feeds.py:596-599` | OOM risk on large date ranges |
| P2-2 | `process-onboarding-emails` — unbounded batch | `cron_jobs.py:650` | Timeout risk on large backlog |
| P2-3 | No dynamic imports on heavy dashboard pages | `apps/web/app/(dashboard)/` | Full bundle shipped synchronously |
| P2-4 | No bundle analyser | `next.config.ts` | Bundle composition opaque |
| P2-5 | No cache invalidation on mutations | All write routes | Stale data served for up to 5 min |

### LOW

| ID | Issue | Location | Impact |
|---|---|---|---|
| P3-1 | 58/76 dashboard pages are full client components | `apps/web/app/(dashboard)/` | No streaming; heavier JS bundles |
| P3-2 | Only 28 Suspense/loading boundaries across 76 pages | `apps/web/app/` | Poor perceived load performance |
| P3-3 | `quote_items.quote_id` FK not covered by composite index | `indexes.py` | Mild for quote list joins |
| P3-4 | No task queue for background jobs | `cron_jobs.py` | Timeout risk on long-running jobs |
| P3-5 | `cron_jobs.py:274` fetches all `XeroConnection` rows | `cron_jobs.py` | Negligible now, risk at scale |

---

## Metrics Dashboard

| Metric | Value | Target | Status |
|---|---|---|---|
| Core list endpoints with pagination | 4 / 4 | 4 / 4 | PASS |
| Core list endpoints N+1 free | 4 / 4 | 4 / 4 | PASS |
| Active Redis cache decorators | 8 endpoints | All hot paths | PARTIAL |
| Dashboard cache active | 0 / 9 endpoints | 9 / 9 | FAIL |
| Composite indexes defined | 3 | 3 core + trgm | PARTIAL |
| ILIKE search indexes (trigram) | 0 | ≥4 | FAIL |
| Unbounded `.scalars().all()` in routes | ~13 genuine | 0 critical | PARTIAL |
| Dynamic imports on heavy pages | 0 | ≥5 | FAIL |
| Bundle analyser configured | No | Yes | FAIL |
| `productionBrowserSourceMaps` | `true` | `false` | FAIL |
| Cron batch limits | 2 / 6 jobs | 6 / 6 | PARTIAL |
| DB pool size (async, serverless) | 5 + 10 overflow | Appropriate | PASS |
| Prepared statement cache disabled | Yes (pgbouncer) | Required | PASS |

---

**Audit completed**: 2026-03-24
