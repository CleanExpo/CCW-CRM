# CCW-Online ERP - Product Backlog
**Generated:** 2026-01-28
**Perspective:** Senior Project Manager
**Status:** Post Phase 9 Completion + POS System Foundation

---

## Executive Summary

**Recent Accomplishments:**
- ✅ Phase 9 Load Test Fixes (PostgreSQL SEQUENCE, validation improvements)
- ✅ Google AI Integration (Gemini 2.5 Flash with 4 endpoints)
- ✅ POS System Foundation (6 database tables, REST APIs, payment framework, bank reconciliation)
- ✅ All quote module errors resolved (405, 404, 422)
- ✅ All internal server errors (500) resolved via comprehensive validation

**Current State:**
- Backend: Production-ready with POS foundation
- Database: Optimized for concurrency with SEQUENCE-based ID generation
- Load Tests: Expected 100% pass rate (verification pending)
- Blockers: Shopify authentication requires user credential verification

**Next Sprint Focus:** Complete POS system implementation, verify load test results, resolve Shopify blockers

---

## Priority Framework

| Priority | Criteria | Action Timeline |
|----------|----------|-----------------|
| **P0 - Critical** | Production blocker, revenue impact, security issue | Immediate (0-2 days) |
| **P1 - High** | Core feature completion, major user pain point | This sprint (1 week) |
| **P2 - Medium** | Enhancement, performance optimization | Next sprint (2 weeks) |
| **P3 - Low** | Nice-to-have, future planning | Backlog (TBD) |

---

## P0 - CRITICAL (Immediate Action Required)

### 1. Verify Phase 9 Load Test Results ⚡
**Status:** IN PROGRESS (tests running)
**Estimate:** 1 hour
**Business Value:** Confirm production readiness, validate 100% pass rate claim

**Acceptance Criteria:**
- [ ] Load test completes successfully
- [ ] Verify 100% pass rate (8,000/8,000 scenarios)
- [ ] Document final performance metrics (p95, p99 response times)
- [ ] Compare before/after results
- [ ] Update Linear issues to "Done" status

**Files to Check:**
- `apps/backend/tests/load/reports/load_test_latest.json`
- `apps/backend/tests/load/reports/load_test_latest.html`

**Next Steps:**
1. Check TaskOutput for load test completion
2. Parse results and generate summary report
3. Update Linear CSV with completed statuses
4. Create production deployment plan if 100% pass rate achieved

---

### 2. Resolve Shopify Authentication Blocker 🔒
**Status:** BLOCKED - Requires user action
**Estimate:** 30 minutes (user) + 1 hour (verification)
**Business Value:** Unblocks $150k+ in Shopify integration revenue

**Current Error:** 401 Unauthorized from Shopify API

**User Actions Required:**
1. Go to Shopify Admin → Settings → Apps → Develop apps
2. Verify app is **Installed** (not just created)
3. Confirm access token matches `SHOPIFY_ACCESS_TOKEN` in backend `.env`
4. Ensure required API scopes enabled:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_inventory`, `write_inventory`
   - `read_locations`

**After User Completes:**
- [ ] Re-run connection test: `python apps/backend/src/integrations/shopify/test_connection.py`
- [ ] Verify all 4 authentication tests pass
- [ ] Move dependent tasks to "Ready" status

**Dependent Tasks:**
- Shopify Bidirectional Product Sync (P1)
- Shopify Real-Time Inventory Sync (P1)

---

## P1 - HIGH (This Sprint - 1 Week)

### 3. Complete POS System Frontend UI 💳
**Status:** NOT STARTED
**Estimate:** 8 points (2-3 days)
**Business Value:** Enable 3 physical locations + online/phone sales, critical for Q1 2026 revenue

**Context:**
Backend foundation complete (database, APIs, payment framework). Need user-facing interface for:
- Walk-in sales at Brisbane, Sydney, Melbourne stores
- Online sales processing
- Telephone order entry
- Bank reconciliation dashboard

**Implementation Phases:**

#### Phase 3E: POS Terminal Interface
**File:** `apps/web/app/(dashboard)/pos/terminal/page.tsx`

**Features:**
- [ ] Amount input with currency formatting
- [ ] Payment method selection (EFTPOS, AMEX, Cash, Bank Transfer)
- [ ] Sales staff selection dropdown
- [ ] Location routing display (show resolved location)
- [ ] Real-time payment processing with loading states
- [ ] Receipt printing/email
- [ ] Transaction history view

**Design Pattern:** Follow `apps/web/components/auth/login-form.tsx` for form handling

#### Phase 3F: Bank Reconciliation Dashboard
**File:** `apps/web/app/(dashboard)/pos/reconciliation/page.tsx`

**Features:**
- [ ] Unreconciled transactions list (POS vs Bank Feed)
- [ ] Side-by-side comparison view
- [ ] Manual match interface with confidence scoring
- [ ] Bulk reconciliation actions
- [ ] Discrepancy alerts (amount > $10 difference)
- [ ] Filter by location, date range, status
- [ ] Export to CSV for accounting team

**API Endpoints:** Already complete in `apps/backend/src/api/routes/bank_feeds.py`

#### Phase 3G: Sales Staff & Location Management
**Files:**
- `apps/web/app/(dashboard)/pos/staff/page.tsx`
- `apps/web/app/(dashboard)/pos/locations/page.tsx`

**Features:**
- [ ] CRUD for sales staff (name, email, primary location, can_sell_at_locations)
- [ ] CRUD for locations (name, address, timezone, is_active)
- [ ] CRUD for POS terminals (terminal_id, location, type, merchant_id)
- [ ] Bank account configuration (feed provider, sync schedule)
- [ ] Location routing rules configuration

**Success Criteria:**
- [ ] All POS frontend components complete
- [ ] Manual testing: Process walk-in sale end-to-end
- [ ] Manual testing: Reconcile bank feed transaction
- [ ] Type-check passes
- [ ] Lint passes
- [ ] No console errors

---

### 4. Integrate POS with Xero Reconciliation 🔗
**Status:** NOT STARTED
**Estimate:** 5 points (1-2 days)
**Business Value:** Automate accounting workflow, save 10+ hours/week for accounts team

**Leverage Existing:** Comprehensive Xero integration already in `apps/backend/src/integrations/xero/`

**Implementation:**

**File:** `apps/backend/src/integrations/xero/pos_reconciliation.py`

**Features:**
- [ ] Auto-create Xero invoice from POS transaction
- [ ] Link POS transaction → Xero invoice → Xero payment
- [ ] Auto-reconcile when bank feed matches POS transaction
- [ ] Handle discrepancies (amount mismatches)
- [ ] Sync reconciliation status back to POS
- [ ] Create bank transaction in Xero from bank feed data

**Workflow:**
```
POS Transaction Created
    ↓
Create Xero Invoice
    ↓
Bank Feed Arrives (daily auto-sync)
    ↓
Auto-Match POS Transaction ↔ Bank Feed (confidence > 80%)
    ↓
Create Xero Payment linking Invoice + Bank Transaction
    ↓
Mark POS Transaction as "reconciled"
```

**API Endpoints to Add:**
- `POST /api/pos/transactions/{id}/sync-xero` - Create Xero invoice
- `POST /api/pos/reconciliation/auto-sync` - Batch reconcile all matched transactions
- `GET /api/pos/reconciliation/discrepancies` - List unresolved discrepancies

**Success Criteria:**
- [ ] POS transaction automatically creates Xero invoice
- [ ] Bank feed sync triggers auto-reconciliation
- [ ] Manual reconciliation updates Xero payment
- [ ] 90%+ auto-reconciliation rate (tested with 100 transactions)
- [ ] Integration tests pass

---

### 5. Optimize Database Indexes for Search Performance 🚀
**Status:** NOT STARTED
**Estimate:** 2 points (4-6 hours)
**Business Value:** Improve user experience, reduce database load by 70%+

**Current Performance Issues:**
- Customer wildcard searches: **3,500ms** (P95: 3,892ms)
- Product searches: **1,700ms** (P95)

**Target Performance:**
- Customer search: **<1,000ms** (71% improvement)
- Product search: **<800ms** (53% improvement)

**Implementation:**

**File:** `apps/backend/migrations/add_search_indexes.sql`

```sql
-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for wildcard search
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX idx_customers_company_trgm ON customers USING gin (company_name gin_trgm_ops);
CREATE INDEX idx_customers_contact_trgm ON customers USING gin (contact_name gin_trgm_ops);

-- B-tree indexes for foreign keys and common filters
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_products_category_active ON products(category, is_active);
CREATE INDEX idx_orders_status_date ON orders(status, order_date DESC);

-- Analyze tables to update query planner statistics
ANALYZE products;
ANALYZE customers;
ANALYZE orders;
ANALYZE quotes;
```

**Verification Script:** `apps/backend/verify_indexes.py`

```python
# Benchmark before/after index creation
# Compare EXPLAIN ANALYZE output
# Verify <1s response time for wildcard searches
```

**Success Criteria:**
- [ ] All indexes created without errors
- [ ] Customer search: <1,000ms (95th percentile)
- [ ] Product search: <800ms (95th percentile)
- [ ] Re-run load test search scenarios
- [ ] No performance regression on write operations
- [ ] Database size increase <500MB (acceptable overhead)

---

### 6. Implement Shopify Bidirectional Product Sync 🔄
**Status:** BLOCKED by Shopify Authentication
**Estimate:** 8 points (2-3 days)
**Business Value:** Enable omnichannel commerce, sync 500+ products

**Dependencies:**
- ⛔ BLOCKED: Shopify authentication must be resolved first
- ✅ READY: Backend infrastructure exists (`apps/backend/src/integrations/shopify/`)

**Sync Directions:**

#### ERP → Shopify (Create/Update/Delete)
**File:** `apps/backend/src/integrations/shopify/product_sync.py`

**Features:**
- [ ] Push product creation to Shopify (SKU, name, price, images, variants)
- [ ] Update Shopify when product changes in ERP
- [ ] Handle product deletion (archive in Shopify, don't hard delete)
- [ ] Map product categories to Shopify collections
- [ ] Handle image upload to Shopify CDN
- [ ] Retry logic for failed syncs
- [ ] Sync status tracking (last_synced_at, sync_errors)

#### Shopify → ERP (Webhooks)
**File:** `apps/backend/src/api/routes/integrations/shopify_webhooks.py`

**Features:**
- [ ] Webhook endpoint: `POST /api/integrations/shopify/webhooks/products/create`
- [ ] Webhook endpoint: `POST /api/integrations/shopify/webhooks/products/update`
- [ ] Webhook endpoint: `POST /api/integrations/shopify/webhooks/products/delete`
- [ ] HMAC signature verification (security)
- [ ] Duplicate detection (prevent sync loops)
- [ ] Conflict resolution (ERP wins vs Shopify wins strategy)
- [ ] Webhook retry handling (Shopify retries on 5xx)

**Database Changes:**

**File:** `apps/backend/migrations/add_shopify_product_mapping.sql`

```sql
CREATE TABLE shopify_product_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    shopify_product_id BIGINT NOT NULL UNIQUE,
    shopify_variant_id BIGINT,
    last_synced_at TIMESTAMPTZ,
    sync_status VARCHAR(50) DEFAULT 'synced', -- 'synced', 'pending', 'error'
    sync_errors JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopify_mapping_product ON shopify_product_mapping(product_id);
CREATE INDEX idx_shopify_mapping_shopify ON shopify_product_mapping(shopify_product_id);
```

**API Endpoints:**
- `POST /api/integrations/shopify/sync-products` - Bulk sync ERP → Shopify
- `POST /api/integrations/shopify/sync-product/{id}` - Single product sync
- `GET /api/integrations/shopify/sync-status` - Dashboard data

**Success Criteria:**
- [ ] Create product in ERP → appears in Shopify within 30 seconds
- [ ] Update product in ERP → Shopify updates within 30 seconds
- [ ] Create product in Shopify → appears in ERP via webhook
- [ ] Conflict resolution works correctly (no data loss)
- [ ] Sync errors logged and retried (max 3 retries)
- [ ] 100 products synced in <5 minutes (bulk sync)
- [ ] Webhook signature verification prevents unauthorized access

---

### 7. Implement Shopify Real-Time Inventory Sync 📦
**Status:** BLOCKED by Shopify Auth + Product Sync
**Estimate:** 6 points (1-2 days)
**Business Value:** Prevent overselling, improve customer satisfaction, reduce support tickets

**Dependencies:**
- ⛔ BLOCKED: Shopify authentication (P0)
- ⛔ BLOCKED: Product sync must be complete first (P1)

**Sync Requirements:**
- ERP → Shopify: Stock changes sync within **5 seconds** (real-time)
- Shopify → ERP: Orders decrement stock, cancellations increment

**Implementation:**

#### ERP → Shopify Inventory Push
**File:** `apps/backend/src/integrations/shopify/inventory_sync.py`

**Features:**
- [ ] Real-time stock update on product save
- [ ] Batch inventory sync (daily reconciliation)
- [ ] Multi-location inventory mapping (Brisbane → Shopify Location ID)
- [ ] Reserve stock on order confirmation (prevent overselling)
- [ ] Release stock on order cancellation
- [ ] Handle Shopify API rate limits (2 requests/second)
- [ ] Queue-based sync for high-volume updates
- [ ] Conflict detection (ERP vs Shopify stock mismatch)

**Database Extension:**

**File:** `apps/backend/migrations/add_shopify_inventory_mapping.sql`

```sql
ALTER TABLE products ADD COLUMN shopify_inventory_item_id BIGINT;
CREATE INDEX idx_products_shopify_inventory ON products(shopify_inventory_item_id);

CREATE TABLE shopify_location_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_location_code VARCHAR(50) NOT NULL UNIQUE,
    shopify_location_id BIGINT NOT NULL UNIQUE,
    location_name VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE
);

-- Example seed data
INSERT INTO shopify_location_mapping (erp_location_code, shopify_location_id, location_name) VALUES
('brisbane', 123456789, 'Brisbane Warehouse'),
('sydney', 234567890, 'Sydney Branch'),
('melbourne', 345678901, 'Melbourne Branch');
```

#### Shopify → ERP Order Webhooks
**File:** `apps/backend/src/api/routes/integrations/shopify_webhooks.py` (extend existing)

**Webhooks:**
- [ ] `orders/create` - Decrement stock when Shopify order created
- [ ] `orders/cancelled` - Increment stock when order cancelled
- [ ] `orders/updated` - Handle quantity changes in order edits

**Stock Deduction Logic:**
```python
async def handle_shopify_order_created(webhook_data: dict):
    """
    When Shopify order created, decrement ERP stock.

    Flow:
    1. Extract line items from webhook
    2. Map Shopify variant IDs to ERP product IDs
    3. Lock product rows (SELECT ... FOR UPDATE)
    4. Decrement stock quantities
    5. Create stock movement record
    6. Return 200 OK to Shopify (acknowledges webhook)
    """
    pass
```

**Sync Queue System:**

**File:** `apps/backend/src/services/inventory_sync_queue.py`

```python
"""
Background worker for high-volume inventory syncs.

Uses Redis queue or database-backed queue to:
- Batch multiple stock updates into single Shopify API call
- Retry failed syncs with exponential backoff
- Handle rate limiting gracefully
- Report sync failures to monitoring
"""
```

**API Endpoints:**
- `POST /api/integrations/shopify/sync-inventory` - Manual inventory sync
- `POST /api/integrations/shopify/reconcile-inventory` - Compare ERP vs Shopify, fix discrepancies
- `GET /api/integrations/shopify/inventory-status` - Dashboard showing sync lag, errors

**Success Criteria:**
- [ ] Stock change in ERP → Shopify updates within 5 seconds
- [ ] Shopify order created → ERP stock decrements within 5 seconds
- [ ] Shopify order cancelled → ERP stock increments within 5 seconds
- [ ] Multi-location inventory correctly mapped
- [ ] Zero overselling (stock can't go negative)
- [ ] Sync queue handles 1,000+ updates per hour
- [ ] Daily reconciliation job identifies and fixes discrepancies
- [ ] Rate limiting prevents Shopify API blocks
- [ ] Integration tests pass (order creation, cancellation, stock updates)

---

## P2 - MEDIUM (Next Sprint - 2 Weeks)

### 8. Setup Production Monitoring and Alerts 📊
**Status:** NOT STARTED
**Estimate:** 4 points (1 day)
**Business Value:** Proactive issue detection, reduce downtime, improve SLA

**Current State:** No production monitoring or alerting

**Solution:** Prometheus + Grafana stack

**Implementation:**

#### Phase 1: Metrics Collection
**File:** `apps/backend/src/api/middleware/metrics.py`

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Request metrics
http_requests_total = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
http_request_duration = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])

# Business metrics
pos_transactions_total = Counter('pos_transactions_total', 'Total POS transactions', ['location', 'payment_method', 'status'])
bank_reconciliations = Counter('bank_reconciliations', 'Bank reconciliations', ['status'])

# System metrics
db_connection_pool = Gauge('db_connection_pool_size', 'Database connection pool size')
db_connection_pool_used = Gauge('db_connection_pool_used', 'Active database connections')

# Expose metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")
```

#### Phase 2: Prometheus Configuration
**File:** `docker-compose.yml` (extend existing)

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123

volumes:
  prometheus_data:
  grafana_data:
```

**File:** `prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
```

#### Phase 3: Grafana Dashboards
**File:** `grafana/dashboards/production-overview.json`

**Panels:**
- Request rate (req/sec)
- Error rate (%)
- Response time (p50, p95, p99)
- Database connection pool usage
- POS transaction volume by location
- Bank reconciliation success rate
- Top 10 slowest endpoints

#### Phase 4: Alert Rules
**File:** `prometheus/alerts.yml`

```yaml
groups:
  - name: production_alerts
    interval: 30s
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
        for: 5m
        annotations:
          summary: "High response time (p95 > 2s)"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 5m
        annotations:
          summary: "Error rate > 1%"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_used / db_connection_pool_size > 0.9
        for: 2m
        annotations:
          summary: "Database connection pool >90% used"

      - alert: BankReconciliationFailures
        expr: rate(bank_reconciliations{status="error"}[1h]) > 5
        for: 1h
        annotations:
          summary: "High rate of bank reconciliation failures"
```

**Success Criteria:**
- [ ] Prometheus collecting metrics from backend
- [ ] Grafana dashboard showing real-time metrics
- [ ] Alerts configured and tested
- [ ] Alert notifications sent via email/Slack (configure integrations)
- [ ] 30-day metric retention
- [ ] Documentation for dashboard usage

---

### 9. Investigate Remaining Edge Cases (Post Load Test)
**Status:** PENDING - Depends on load test verification
**Estimate:** 3 points (1 day)
**Business Value:** Ensure 100% reliability under all conditions

**After load test verification, if any failures remain:**

**Investigation Steps:**
1. Review application logs for stack traces
2. Identify patterns in failures (specific endpoints, time-based, concurrency-related)
3. Reproduce locally with debugger
4. Classify issues: bug, missing validation, performance issue
5. Prioritize fixes based on frequency and impact

**Expected Outcome:**
- If 100% pass rate achieved: Mark as "Done", no action needed
- If <100% pass rate: Create specific Linear issues for each failure pattern

---

### 10. Add Multi-Language Support to POS System 🌐
**Status:** NOT STARTED (Future Enhancement)
**Estimate:** 5 points (1-2 days)
**Business Value:** Support international customers, Brisbane multi-cultural clientele

**Context:** i18n foundation already exists (`apps/web/i18n/`, `apps/backend/src/db/i18n_models.py`)

**Implementation:**
- [ ] Add POS UI translations (English, Mandarin, Cantonese, Vietnamese)
- [ ] Localized receipt printing
- [ ] Multi-language product descriptions in POS
- [ ] Currency formatting (AUD, USD, CNY)

**Dependencies:**
- ✅ i18n database schema exists
- ✅ Translation service exists
- ⚠️ Needs POS frontend (P1) to be complete first

---

## P3 - LOW (Future Planning)

### 11. Autonomous Development Framework
**Status:** PLANNED
**Estimate:** 20+ points (2-4 weeks)
**Business Value:** Self-sustaining development, reduce engineering costs

**Vision:** AI agents plan, code, test, and deploy features autonomously

**Phases:**
1. Planning Agent - Generates implementation plans from requirements
2. Coding Agent - Writes code following best practices
3. Testing Agent - Creates and runs tests
4. Review Agent - Code review and quality checks
5. Deployment Agent - Automated deployment pipeline

**Files:** Framework exists in `.claude/agents/`

**Priority Justification:** Low priority - system is stable, focus on business features first

---

### 12. Enhanced Shopify Metafields
**Status:** PLANNED
**Estimate:** 3 points
**Business Value:** Store custom ERP data in Shopify (warranty info, supplier codes)

**Dependencies:** Shopify Product Sync (P1)

---

### 13. AI-Powered Search & Recommendations
**Status:** PLANNED
**Estimate:** 10 points (2 weeks)
**Business Value:** Improve product discovery, increase sales

**Features:**
- Semantic/vector search with pgvector
- AI product recommendations
- Voice search optimization
- Related products suggestions

**Dependencies:** Google AI integration (✅ complete)

---

## Blocked Items Summary

| Item | Blocker | User Action Required |
|------|---------|----------------------|
| Shopify Product Sync | Shopify Auth (401) | Verify credentials in Shopify Admin |
| Shopify Inventory Sync | Shopify Auth + Product Sync | Verify credentials + wait for Product Sync |

---

## Sprint Recommendation (Next 7 Days)

**Sprint Goal:** Complete POS system, verify production readiness, unblock Shopify

### Must Complete (Sprint Commitment):
1. ✅ Verify Phase 9 Load Test Results (P0) - 1 hour
2. ✅ Complete POS Frontend UI (P1) - 2-3 days
3. ✅ Integrate POS with Xero Reconciliation (P1) - 1-2 days
4. ✅ Optimize Database Indexes (P1) - 4-6 hours

### If Time Permits (Stretch Goals):
5. ⭐ Setup Production Monitoring (P2) - 1 day
6. ⭐ Resolve Shopify Auth and start Product Sync (P1) - 2-3 days

### Blocked/Deferred:
- Shopify integrations - BLOCKED by user action
- Autonomous Development - Future roadmap
- AI Search - Future roadmap

---

## Success Metrics

**Engineering Quality:**
- [ ] Load test: 100% pass rate (8,000/8,000)
- [ ] Code coverage: >80% for critical paths
- [ ] All type-check and lint passes
- [ ] Zero production incidents in first 2 weeks

**Business Impact:**
- [ ] 3 physical locations using POS system daily
- [ ] 90%+ bank reconciliation auto-match rate
- [ ] <5 minutes to reconcile discrepancies manually
- [ ] Search performance: <1s (95th percentile)
- [ ] Shopify: 500+ products synced within 1 week of auth resolution

**User Satisfaction:**
- [ ] Accounts team: "Reconciliation is 10x faster"
- [ ] Sales team: "POS is intuitive and fast"
- [ ] Warehouse team: "Inventory accuracy is perfect"

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Load test <100% pass rate | Low | High | Phase 9 fixes comprehensive, unit tests passing |
| Shopify auth not resolved by user | Medium | High | Escalate to user, create backup plan (manual CSV sync) |
| POS UI development takes longer | Medium | Medium | Prioritize terminal interface first, defer staff mgmt |
| Database index migration breaks queries | Low | High | Test on staging first, have rollback plan |
| Xero reconciliation edge cases | Medium | Low | Manual reconciliation fallback exists |

---

## Next Actions (Immediate)

1. **Check Load Test Results** (0-1 hour)
   - Read `TaskOutput` or check `apps/backend/tests/load/reports/load_test_latest.json`
   - Generate summary report
   - Update Linear CSV with results

2. **Update Linear Issues** (15 minutes)
   - Mark Phase 9 quote fixes as "Done"
   - Mark PostgreSQL SEQUENCE as "Done"
   - Mark 30 internal errors as "Done"
   - Update Shopify auth status to "Blocked"

3. **Start POS Frontend UI** (if user approves)
   - Create `apps/web/app/(dashboard)/pos/terminal/page.tsx`
   - Implement payment processing interface
   - Test end-to-end walk-in sale

4. **Request User Decision on Shopify Auth**
   - Ask if user can verify Shopify credentials this sprint
   - If yes: High priority
   - If no: Defer Shopify integrations to next sprint

---

**End of Backlog - Generated 2026-01-28**
