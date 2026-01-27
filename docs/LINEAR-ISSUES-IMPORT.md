# Linear Issues - Import Template

Copy and paste each issue below into Linear to create the full task list.

---

## EPIC: Phase 9 - Performance Testing Complete ✅

**Status**: Done
**Priority**: Critical
**Labels**: phase-9, performance-testing, milestone
**Start Date**: 2026-01-27
**Completed Date**: 2026-01-27

### Description

Completed comprehensive load testing suite with 8,000 scenarios across all system modules.

### Results

- ✅ Overall pass rate: 90.9% (7,272/8,000 scenarios)
- ✅ Products module: 100% pass rate - PRODUCTION READY
- ✅ Customers module: 100% pass rate - PRODUCTION READY
- ✅ Orders module: 96.6% pass rate - PRODUCTION READY
- ⚠️ Quotes module: 67.0% pass rate - REQUIRES FIXES

### Performance Metrics

- Average response time: 1,453ms ✅
- P50 response time: 1,126ms ✅
- P95 response time: 3,134ms ✅
- P99 response time: 4,339ms ✅
- Throughput: 1.38 req/sec ✅
- System stability: EXCELLENT (zero crashes)

### Deliverables

- ✅ Performance baseline document (500+ lines)
- ✅ HTML report generated
- ✅ JSON metrics exported
- ✅ Production readiness checklist

### Sub-Tasks (All Complete)

1. ✅ Fix PostgreSQL ENUM type mismatches
2. ✅ Fix Order/Quote schema alignment
3. ✅ Investigate test failures (root cause: race conditions)
4. ✅ Achieve 80% smoke test pass rate (achieved 100%)
5. ✅ Execute full 8,000 scenario load test
6. ✅ Document performance baselines

### Documentation

- `docs/PHASE-9-PERFORMANCE-BASELINE.md`
- `docs/PHASE-9-INVESTIGATION-SUMMARY.md`
- `docs/SESSION-SUMMARY-2026-01-27-PHASE9-COMPLETE.md`
- `tests/load/reports/load_test_latest.json`

---

## ISSUE #1: Fix Quote Module Routing Errors (405)

**Status**: To Do
**Priority**: Critical 🔴
**Labels**: bug, quotes, backend, api-routing, blocking-production
**Estimate**: 2-3 hours
**Blocked By**: None
**Blocks**: Quote Module Production Deployment

### Problem

100 quote scenarios failing with **405 Method Not Allowed** errors during load testing. This indicates HTTP method configuration issues on quote endpoints.

### Impact

- 5% of quote operations fail completely
- Quote module cannot be deployed to production
- Contributes to 67% pass rate (below 95% target)

### Root Cause (Preliminary)

HTTP methods (PUT/PATCH/DELETE) not properly configured on certain quote endpoints. Possible issues:
1. FastAPI route decorators missing HTTP methods
2. Endpoint path conflicts (e.g., `/quotes/{id}` vs `/quotes/convert`)
3. Router registration issues

### Acceptance Criteria

- [ ] Identify all endpoints returning 405 errors
- [ ] Review FastAPI route decorators in `apps/backend/src/api/routes/quotes.py`
- [ ] Fix HTTP method configuration
- [ ] Add integration tests for all HTTP methods on quote endpoints
- [ ] Re-run focused quote load test (2,000 scenarios)
- [ ] Verify 0 instances of 405 errors

### Technical Details

**Files to Check**:
- `apps/backend/src/api/routes/quotes.py` - Quote endpoints
- `apps/backend/src/api/main.py` - Router registration
- `apps/backend/tests/load/generators/quotes.py` - Test scenarios

**Expected Endpoints**:
```python
GET    /api/quotes           # List quotes
POST   /api/quotes           # Create quote
GET    /api/quotes/{id}      # Get single quote
PUT    /api/quotes/{id}      # Update quote
DELETE /api/quotes/{id}      # Delete quote
POST   /api/quotes/{id}/convert  # Convert to order
```

### Testing

Run focused test:
```bash
cd apps/backend
pytest tests/load/ -k "quote" -v
```

### Documentation

Update API documentation with all supported HTTP methods.

---

## ISSUE #2: Fix Quote Module Resource Lookup Errors (404)

**Status**: To Do
**Priority**: Critical 🔴
**Labels**: bug, quotes, backend, database, blocking-production
**Estimate**: 3-4 hours
**Blocked By**: None
**Blocks**: Quote Module Production Deployment

### Problem

300 quote scenarios failing with **404 Not Found** errors during load testing. Quote resources created but cannot be retrieved.

### Impact

- 15% of quote operations fail completely
- Major contributor to 67% pass rate
- Data inconsistency (quotes created but "not found")
- Cannot deploy quote module to production

### Root Cause (Preliminary)

Possible issues:
1. **Quote ID generation problems**: UUID generation or database insertion failures
2. **Database constraints**: Unique constraint violations causing silent failures
3. **Cascade delete issues**: Parent records (customers) being deleted, orphaning quotes
4. **Session management**: Database session not committing properly
5. **Race conditions**: Quote created but not yet visible to subsequent reads

### Acceptance Criteria

- [ ] Identify which quote operations return 404 errors
- [ ] Review quote creation logic in `apps/backend/src/api/routes/quotes.py`
- [ ] Review database models and relationships in `apps/backend/src/db/demo_models.py`
- [ ] Add comprehensive logging to quote CRUD operations
- [ ] Fix root cause of 404 errors
- [ ] Add integration tests for quote lifecycle (create → read → update → delete)
- [ ] Re-run focused quote load test (2,000 scenarios)
- [ ] Verify 0 instances of 404 errors

### Technical Details

**Files to Investigate**:
- `apps/backend/src/api/routes/quotes.py` - Quote CRUD endpoints
- `apps/backend/src/db/demo_models.py` - Quote and QuoteItem models
- `apps/backend/tests/load/generators/quotes.py` - Test scenarios

**Database Relationships**:
```python
Quote.customer_id → Customer.id
QuoteItem.quote_id → Quote.id (CASCADE DELETE)
QuoteItem.product_id → Product.id
```

**Debugging Steps**:
1. Add logging before/after database commits
2. Check if quote IDs are being generated correctly
3. Verify database constraints are not silently failing
4. Test quote retrieval immediately after creation
5. Check if concurrent operations cause visibility issues

### Testing

Run diagnostic:
```bash
cd apps/backend
python -m pytest tests/load/ -k "quote_create" -v --log-cli-level=DEBUG
```

Check database state after failed scenarios:
```sql
SELECT COUNT(*) FROM quotes;
SELECT COUNT(*) FROM quote_items;
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 10;
```

### Documentation

Document quote lifecycle and error handling in API docs.

---

## ISSUE #3: Fix Quote Module Validation Errors (422)

**Status**: To Do
**Priority**: High 🟠
**Labels**: bug, quotes, backend, validation, blocking-production
**Estimate**: 2-3 hours
**Blocked By**: None
**Blocks**: Quote Module Production Deployment

### Problem

200 quote scenarios failing with **422 Unprocessable Entity** errors during load testing. Request data fails Pydantic validation.

### Impact

- 10% of quote operations fail due to validation
- Contributes to 67% pass rate
- User experience issue (unclear error messages)
- Cannot deploy quote module to production

### Root Cause (Preliminary)

Pydantic validation failures on quote create/update operations. Possible issues:
1. **Date format issues**: `valid_until` field expecting specific ISO 8601 format
2. **Missing required fields**: `customer_id`, `quote_items` not provided
3. **Price/quantity validation**: Negative values, zero quantities
4. **Line items validation**: Empty quote_items array
5. **Status validation**: Invalid status transitions

### Acceptance Criteria

- [ ] Collect all 422 validation error messages from load test
- [ ] Review Pydantic schemas in `apps/backend/src/api/routes/quotes.py`
- [ ] Identify which fields are failing validation
- [ ] Fix validation rules or test data generators
- [ ] Ensure error messages are clear and actionable
- [ ] Add comprehensive validation tests
- [ ] Re-run focused quote load test (2,000 scenarios)
- [ ] Verify 0 instances of 422 errors (except intentional validation tests)

### Technical Details

**Files to Review**:
- `apps/backend/src/api/routes/quotes.py` - Pydantic schemas (QuoteCreate, QuoteUpdate)
- `apps/backend/tests/load/generators/quotes.py` - Test data generators

**Common Validation Issues**:

1. **Date Format**:
```python
# WRONG
valid_until: "2026-01-27"

# CORRECT
valid_until: "2026-01-27T00:00:00Z"  # ISO 8601 with time
```

2. **Quote Items**:
```python
# WRONG
quote_items: []  # Empty array

# CORRECT
quote_items: [
    {"product_id": uuid, "quantity": 1, "unit_price": 99.99}
]
```

3. **Customer ID**:
```python
# WRONG
customer_id: None

# CORRECT
customer_id: "uuid-of-existing-customer"
```

### Testing

Run validation tests:
```bash
cd apps/backend
pytest tests/api/test_quotes.py -v

# Test with intentionally invalid data
pytest tests/api/test_quotes_validation.py -v
```

### Documentation

- Document all required fields in API docs
- Provide example request bodies
- Document validation rules and error messages

---

## ISSUE #4: Deploy Microsecond Timestamp Fix

**Status**: To Do
**Priority**: High 🟠
**Labels**: deployment, backend, race-conditions, performance
**Estimate**: 2 hours
**Blocked By**: None
**Blocks**: High Concurrency Testing

### Problem

Permanent fix for order/quote number race conditions is coded but not deployed to container. System must run with reduced concurrency (max_concurrent=2) as a workaround.

### Impact

- Cannot increase concurrency beyond max_concurrent=2
- Lower throughput (1.38 req/sec vs potential 3+ req/sec)
- 98 race condition failures (409 conflicts) still occur under load
- System not running at full capacity

### Solution

Microsecond timestamp-based number generation already implemented in:
- `apps/backend/src/api/routes/orders.py`
- `apps/backend/src/api/routes/quotes.py`

**Before** (sequential counter):
```python
ORD-2026-001
ORD-2026-002  # Race condition: two requests might get same number
```

**After** (microsecond timestamp):
```python
ORD-2026-012711131445678901  # YYYYMMDDHHMMSS + 6-digit microseconds
ORD-2026-012711131445678923  # Unique even if created microseconds apart
```

### Acceptance Criteria

- [ ] Rebuild backend container with updated code
- [ ] Deploy new container image
- [ ] Re-run smoke test (100 scenarios) with max_concurrent=2
- [ ] Verify 100% pass rate (0 conflicts)
- [ ] Increase to max_concurrent=5
- [ ] Re-run smoke test with max_concurrent=5
- [ ] Verify >98% pass rate (minimal conflicts)
- [ ] Update production deployment configuration

### Technical Details

**Files Modified** (already in codebase):
- `apps/backend/src/api/routes/orders.py` - Line 45: `generate_order_number()`
- `apps/backend/src/api/routes/quotes.py` - Line 50: `generate_quote_number()`

**Deployment Steps**:
```bash
# Rebuild container
cd apps/backend
docker build -t ccw-erp-backend:latest .

# Deploy
docker-compose up -d backend

# Verify
docker ps
docker logs ccw-erp-backend
```

**Testing After Deployment**:
```bash
cd apps/backend
pytest tests/load/test_smoke.py -v

# Verify 0 instances of 409 conflicts in output
```

### Success Metrics

- Zero 409 conflict errors at max_concurrent=5
- Pass rate remains >98%
- Throughput increases to 2.5-3.0 req/sec

### Documentation

Update deployment guide with new container build instructions.

---

## ISSUE #5: Investigate and Fix 30 Internal Server Errors

**Status**: To Do
**Priority**: Medium 🟡
**Labels**: bug, backend, stability
**Estimate**: 3-4 hours
**Blocked By**: None

### Problem

30 scenarios failed with **500 Internal Server Error** during load testing. These represent unhandled exceptions in backend code.

### Impact

- 0.4% of operations fail with server errors
- Indicates bugs in exception handling
- Poor user experience (generic error messages)
- Production reliability concern

### Investigation Steps

1. **Collect Error Details**:
   - Review application logs for stack traces
   - Identify which endpoints returned 500 errors
   - Determine if errors are in specific modules or random

2. **Analyze Patterns**:
   - Are errors clustered in time? (sudden spike)
   - Are errors on specific endpoints? (e.g., always on PUT /quotes/{id})
   - Are errors related to database operations? (connection pool exhaustion)

3. **Reproduce Locally**:
   - Isolate failing scenarios
   - Run with debugger attached
   - Identify exact line of code throwing exception

### Acceptance Criteria

- [ ] Review application logs for all 500 errors
- [ ] Identify root cause for each error type
- [ ] Fix underlying bugs
- [ ] Add proper exception handling where appropriate
- [ ] Add tests for error scenarios
- [ ] Re-run load test
- [ ] Verify <10 internal server errors (0.13% error rate)

### Technical Details

**Log Analysis**:
```bash
cd apps/backend

# Find 500 errors in logs
docker logs ccw-erp-backend 2>&1 | grep "500\|ERROR\|Exception"

# Or check specific log file
tail -1000 logs/application.log | grep "ERROR"
```

**Common Causes**:
1. Database connection errors (pool exhausted)
2. Null pointer errors (missing null checks)
3. Type errors (wrong data type passed)
4. Async/await issues (blocking call in async context)
5. External service timeouts

### Testing

Add error scenario tests:
```python
# tests/api/test_error_handling.py
def test_handles_invalid_data_gracefully():
    response = client.post("/api/orders", json={"invalid": "data"})
    assert response.status_code == 422  # NOT 500

def test_handles_database_error_gracefully():
    with mock.patch("sqlalchemy.AsyncSession.execute", side_effect=Exception("DB Error")):
        response = client.get("/api/orders")
        assert response.status_code == 503  # Service Unavailable, NOT 500
```

### Documentation

- Document error handling patterns
- Add error handling guidelines to development docs

---

## ISSUE #6: Optimize Database Indexes for Search Operations

**Status**: To Do
**Priority**: Medium 🟡
**Labels**: performance, database, optimization
**Estimate**: 2 hours
**Blocked By**: None

### Problem

Customer wildcard searches take 3,500ms on average (P95: 3,892ms). Product searches with filters take 1,700ms. These slow operations impact user experience.

### Impact

- Search operations feel slow to users
- Higher database load
- Opportunity to reduce response times by 50-70%

### Solution

Add **trigram indexes** (PostgreSQL pg_trgm extension) for fuzzy text matching:

```sql
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes for search fields
CREATE INDEX idx_customers_company_name_trgm
ON customers USING gin (company_name gin_trgm_ops);

CREATE INDEX idx_customers_contact_name_trgm
ON customers USING gin (contact_name gin_trgm_ops);

CREATE INDEX idx_products_name_trgm
ON products USING gin (name gin_trgm_ops);

CREATE INDEX idx_products_sku_trgm
ON products USING gin (sku gin_trgm_ops);

-- Add B-tree indexes for foreign keys
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_quote_items_product_id ON quote_items(product_id);
```

### Acceptance Criteria

- [ ] Create database migration script
- [ ] Add pg_trgm extension
- [ ] Create trigram indexes on search fields
- [ ] Create B-tree indexes on foreign keys
- [ ] Run ANALYZE on affected tables
- [ ] Test search performance before/after
- [ ] Verify customer search drops from 3,500ms to <1,000ms
- [ ] Verify product search drops from 1,700ms to <800ms
- [ ] Deploy to production

### Technical Details

**Migration File**: `apps/backend/migrations/add_search_indexes.sql`

**Before/After Testing**:
```sql
-- Test WITHOUT indexes (before)
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE company_name ILIKE '%construction%';
-- Expected: 3,500ms, Seq Scan

-- Test WITH indexes (after)
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE company_name ILIKE '%construction%';
-- Expected: <1,000ms, Bitmap Index Scan on idx_customers_company_name_trgm
```

**Index Monitoring**:
```sql
-- Check index usage
SELECT
    schemaname, tablename, indexname,
    idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Success Metrics

- Customer wildcard search: 3,500ms → <1,000ms (71% improvement)
- Product filtered search: 1,700ms → <800ms (53% improvement)
- Overall P95 response time: 3,134ms → <2,000ms (36% improvement)

### Documentation

- Document indexing strategy
- Add index monitoring to ops runbook

---

## ISSUE #7: Setup Production Monitoring and Alerts

**Status**: To Do
**Priority**: Medium 🟡
**Labels**: devops, monitoring, production, observability
**Estimate**: 4 hours
**Blocked By**: None

### Problem

No production monitoring or alerting in place. Cannot proactively detect performance degradation or errors.

### Impact

- No visibility into production performance
- Issues only discovered when users report problems
- No historical performance data for analysis
- Cannot detect gradual performance degradation

### Solution

Implement Application Performance Monitoring (APM) with:
1. **Metrics Collection**: Response times, error rates, throughput
2. **Alerting**: Automated notifications for issues
3. **Dashboard**: Real-time visualization
4. **Logging**: Structured logs with correlation IDs

### Acceptance Criteria

- [ ] Choose APM solution (DataDog, New Relic, or open-source)
- [ ] Install APM agent in backend container
- [ ] Configure metrics collection
- [ ] Create production dashboard with key metrics
- [ ] Set up alert rules
- [ ] Test alert notifications
- [ ] Document monitoring setup and runbook

### Technical Details

**Recommended APM**: Prometheus + Grafana (open-source)

**Metrics to Collect**:
```yaml
# Response Times
http_request_duration_seconds{endpoint="/api/products", method="GET"}
http_request_duration_seconds_p95{endpoint="/api/orders", method="POST"}

# Error Rates
http_requests_total{status="500"}
http_requests_total{status="404"}

# Throughput
http_requests_per_second_total

# Database
database_connections_active
database_query_duration_seconds_p95

# System Resources
cpu_usage_percent
memory_usage_percent
```

**Alert Rules**:
```yaml
# Alert if P95 response time > 2 seconds
- name: HighResponseTime
  expr: http_request_duration_seconds_p95 > 2.0
  for: 5m
  severity: warning

# Alert if error rate > 1%
- name: HighErrorRate
  expr: (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > 0.01
  for: 5m
  severity: critical

# Alert if database connections exhausted
- name: DatabaseConnectionsLow
  expr: database_connections_available < 5
  for: 2m
  severity: critical
```

**Dashboard Panels**:
1. Request rate (req/sec)
2. Response time (P50, P95, P99)
3. Error rate (% of requests)
4. Top 10 slowest endpoints
5. Error breakdown by status code
6. Database connection pool usage

### Implementation Steps

1. **Add Prometheus Client to Backend**:
```python
# requirements.txt
prometheus-client==0.20.0
prometheus-fastapi-instrumentator==6.1.0

# main.py
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()
Instrumentator().instrument(app).expose(app)
```

2. **Deploy Prometheus + Grafana**:
```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

3. **Configure Alerting**:
```yaml
# alertmanager.yml
route:
  receiver: 'slack-notifications'

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'CCW ERP Alert'
```

### Testing

1. Trigger test alerts:
```bash
# Generate high load to trigger HighResponseTime alert
ab -n 10000 -c 100 http://localhost:8000/api/products

# Verify alert appears in Grafana
# Verify Slack notification received
```

2. Verify dashboard:
```bash
# Open Grafana
http://localhost:3001

# Import dashboard JSON
# Verify metrics are flowing
```

### Documentation

- Monitoring architecture diagram
- Alert runbook (what to do when alerts fire)
- Dashboard guide (how to interpret metrics)

---

## ISSUE #8: Fix Shopify Authentication (401 Unauthorized)

**Status**: Blocked (Waiting on User)
**Priority**: High 🟠
**Labels**: integration, shopify, authentication, external-api
**Estimate**: 1-2 hours (after credentials verified)
**Blocked By**: User verification of Shopify credentials

### Problem

Shopify API connection test failing with **401 Unauthorized** error:
```
{"errors":"[API] Invalid API key or access token (unrecognized login or wrong password)"}
```

### Impact

- Cannot integrate with Shopify for product/order sync
- Blocks real-time inventory synchronization
- Blocks bidirectional product/order flow

### Current Configuration

**Shop**: ccwonline.myshopify.com
**API Version**: 2024-01
**Access Token**: shpss_XXXXXXXXXXXXXXXXXXXX (legacy private app)

### Possible Causes

1. **Private App Not Installed**:
   - App created but not activated on the store
   - Solution: Install app in Shopify Admin

2. **Wrong Credentials**:
   - Access token was regenerated or copied incorrectly
   - Solution: Verify token matches Shopify Admin

3. **Missing API Scopes**:
   - App lacks required permissions
   - Solution: Enable required scopes (read_products, read_orders, etc.)

4. **Incorrect Shop Domain**:
   - Shop domain doesn't match credentials
   - Solution: Verify shop domain is exactly `ccwonline.myshopify.com`

### Required User Actions

**User must verify in Shopify Admin**:

1. Navigate to: **Settings → Apps and sales channels → Develop apps**
2. Find the private app or custom app
3. Verify:
   - ✅ App status is **"Installed"**
   - ✅ Admin API access token matches: `shpss_XXXXXXXXXXXXXXXXXXXX`
   - ✅ Required API scopes are enabled:
     - read_products, write_products
     - read_orders, write_orders
     - read_inventory, write_inventory
     - read_locations
     - read_customers, write_customers (optional)

4. If app is not installed:
   - Click **"Install app"**
   - Copy the NEW access token generated
   - Update `.env` file with new token

5. If credentials are wrong:
   - Regenerate access token in Shopify Admin
   - Copy new token
   - Update `.env` file

### Acceptance Criteria

- [ ] User verifies credentials in Shopify Admin
- [ ] User confirms app is installed
- [ ] User confirms required API scopes are enabled
- [ ] Update `.env` if credentials changed
- [ ] Re-run connection test: `python apps/backend/test_shopify_connection.py`
- [ ] Verify all 4 tests pass:
  - ✅ Test 1: Get shop information
  - ✅ Test 2: List products (first 10)
  - ✅ Test 3: List orders (first 10)
  - ✅ Test 4: Get inventory locations

### Technical Details

**Connection Test Script**: `apps/backend/test_shopify_connection.py`

**Expected Successful Output**:
```
================================================================================
SHOPIFY CONNECTION TEST
================================================================================

[SUCCESS] Running in LIVE mode

Testing connection to Shopify...

[Test 1] Fetching shop information...
[OK] Shop Name: CCW Online
   Shop Owner: John Doe
   Email: info@ccwonline.com.au
   Currency: AUD

[Test 2] Fetching products (first 10)...
[OK] Found 150 products

[Test 3] Fetching orders (first 10)...
[OK] Found 45 orders

[Test 4] Fetching inventory locations...
[OK] Found 2 location(s)

   Locations:
   1. Main Warehouse (ID: 12345678)
   2. Retail Store (ID: 87654321)

================================================================================
[SUCCESS] ALL TESTS PASSED - Shopify connection successful!
================================================================================
```

**Troubleshooting Guide**: `apps/backend/SHOPIFY-CONNECTION-TROUBLESHOOTING.md`

### Alternative Solutions

If private app continues to fail:

**Option A: Create Custom App**
- Modern approach (replaces private apps)
- Better permission granularity
- Access token format: `shpat_` or `shpca_`

**Option B: OAuth Flow**
- Full OAuth2 authentication
- Better for multi-store installations
- Requires web server for callback

### Next Steps After Fix

Once authentication works:
1. [ ] Configure webhook endpoints for real-time sync
2. [ ] Set up product bidirectional sync
3. [ ] Set up inventory real-time sync
4. [ ] Set up order import from Shopify to ERP
5. [ ] Test full sync workflow
6. [ ] Configure webhook secret for signature verification

### Documentation

- Document Shopify authentication setup
- Add troubleshooting guide to ops docs

---

## ISSUE #9: Implement Shopify Bidirectional Product Sync

**Status**: Blocked
**Priority**: High 🟠
**Labels**: integration, shopify, products, sync
**Estimate**: 6-8 hours
**Blocked By**: Issue #8 (Shopify Authentication)

### Description

Implement real-time bidirectional synchronization for products between CCW ERP and Shopify.

### Requirements

**ERP → Shopify** (Push):
- When product created in ERP → Create in Shopify
- When product updated in ERP → Update in Shopify
- When product deleted in ERP → Soft delete/unpublish in Shopify
- Include all product data: name, SKU, price, description, images

**Shopify → ERP** (Pull):
- When product created in Shopify → Create in ERP
- When product updated in Shopify → Update in ERP
- When product deleted in Shopify → Mark as inactive in ERP
- Sync via webhooks for real-time updates

### Technical Implementation

**1. Webhook Endpoints** (`apps/backend/src/api/routes/integrations/shopify_webhooks.py`):
```python
@router.post("/webhooks/shopify/products/create")
async def handle_product_created(request: Request):
    # Verify webhook signature
    # Parse Shopify product data
    # Create product in ERP database
    pass

@router.post("/webhooks/shopify/products/update")
async def handle_product_updated(request: Request):
    # Sync updates to ERP
    pass
```

**2. Product Sync Service** (`apps/backend/src/integrations/shopify/product_sync.py`):
```python
class ProductSyncService:
    async def sync_product_to_shopify(self, product_id: UUID):
        """Push product from ERP to Shopify."""
        pass

    async def sync_product_from_shopify(self, shopify_product_id: int):
        """Pull product from Shopify to ERP."""
        pass
```

**3. Database Schema**:
```sql
-- Track sync status
ALTER TABLE products ADD COLUMN shopify_product_id BIGINT UNIQUE;
ALTER TABLE products ADD COLUMN last_synced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN sync_status VARCHAR(50); -- synced, pending, error
```

### Acceptance Criteria

- [ ] Create webhook endpoints for Shopify product events
- [ ] Implement webhook signature verification
- [ ] Implement ERP → Shopify sync (create, update, delete)
- [ ] Implement Shopify → ERP sync (create, update, delete)
- [ ] Handle sync conflicts (both sides modified simultaneously)
- [ ] Add retry logic for failed syncs
- [ ] Create sync status dashboard
- [ ] Add integration tests for all sync scenarios
- [ ] Configure webhooks in Shopify Admin
- [ ] Test full sync workflow end-to-end

### Testing Scenarios

1. **Create in ERP**: Product should appear in Shopify within 5 seconds
2. **Update in ERP**: Changes should sync to Shopify
3. **Create in Shopify**: Product should appear in ERP
4. **Update in Shopify**: Changes should sync to ERP
5. **Conflict**: Handle simultaneous updates gracefully
6. **Network Failure**: Retry failed syncs automatically

### Success Metrics

- Sync latency: <5 seconds for 95% of operations
- Sync success rate: >99%
- Zero data loss during sync failures
- Clear error messages for failed syncs

### Documentation

- Shopify integration architecture diagram
- Webhook setup guide
- Conflict resolution strategy
- Troubleshooting guide

---

## ISSUE #10: Implement Shopify Real-Time Inventory Sync

**Status**: Blocked
**Priority**: High 🟠
**Labels**: integration, shopify, inventory, real-time
**Estimate**: 4-6 hours
**Blocked By**: Issue #8 (Shopify Authentication), Issue #9 (Product Sync)

### Description

Implement real-time bidirectional inventory synchronization between CCW ERP and Shopify.

### Requirements

**ERP → Shopify** (Push):
- When stock quantity changes in ERP → Update Shopify inventory level
- Support multiple warehouse locations
- Real-time sync (<5 seconds)

**Shopify → ERP** (Pull):
- When order placed in Shopify → Decrement ERP stock
- When order cancelled in Shopify → Increment ERP stock
- Sync via webhooks for real-time updates

### Technical Implementation

**1. Inventory Sync Service**:
```python
class InventorySyncService:
    async def update_shopify_inventory(
        self,
        product_id: UUID,
        location_id: int,
        available: int
    ):
        """Update Shopify inventory level."""
        # Get Shopify inventory item ID
        # Call Shopify inventory_levels/set API
        pass
```

**2. Webhook Handlers**:
```python
@router.post("/webhooks/shopify/orders/create")
async def handle_order_created(request: Request):
    # Decrement ERP stock when Shopify order placed
    pass

@router.post("/webhooks/shopify/orders/cancelled")
async def handle_order_cancelled(request: Request):
    # Increment ERP stock when Shopify order cancelled
    pass
```

**3. Database Schema**:
```sql
-- Track Shopify inventory mappings
CREATE TABLE shopify_inventory_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    shopify_inventory_item_id BIGINT NOT NULL,
    shopify_location_id BIGINT NOT NULL,
    last_synced_at TIMESTAMPTZ,
    last_synced_quantity INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Acceptance Criteria

- [ ] Implement ERP → Shopify inventory sync
- [ ] Implement Shopify → ERP inventory sync (via order webhooks)
- [ ] Configure Shopify inventory location ID in `.env`
- [ ] Handle sync failures gracefully (retry logic)
- [ ] Add inventory sync status to dashboard
- [ ] Create integration tests for all scenarios
- [ ] Test with multiple locations
- [ ] Document inventory sync workflow

### Testing Scenarios

1. **Update in ERP**: Stock change should sync to Shopify within 5 seconds
2. **Order in Shopify**: ERP stock should decrement immediately
3. **Cancel in Shopify**: ERP stock should increment immediately
4. **Out of Stock**: Handle zero/negative inventory correctly
5. **Multiple Locations**: Sync to correct Shopify location

### Success Metrics

- Sync latency: <5 seconds
- Sync accuracy: 100% (no stock discrepancies)
- Zero overselling (stock levels always consistent)

### Documentation

- Inventory sync architecture diagram
- Location mapping configuration
- Troubleshooting guide

---

## EPIC: Production Deployment Preparation

**Status**: To Do
**Priority**: High 🟠
**Labels**: deployment, production, devops
**Start Date**: TBD

### Description

Prepare CCW-Online ERP for production deployment. Includes infrastructure setup, security hardening, monitoring, and deployment automation.

### Sub-Tasks

1. ✅ Phase 9: Performance Testing (COMPLETE)
2. 🔴 Issue #1-3: Fix Quote Module Issues (CRITICAL)
3. 🟠 Issue #4: Deploy Microsecond Timestamp Fix
4. 🟠 Issue #5: Fix Internal Server Errors
5. 🟡 Issue #6: Optimize Database Indexes
6. 🟡 Issue #7: Setup Production Monitoring
7. 🟠 Issue #8-10: Complete Shopify Integration
8. [ ] Security audit and hardening
9. [ ] SSL/TLS certificate setup
10. [ ] Database backup and restore procedures
11. [ ] Disaster recovery plan
12. [ ] User acceptance testing (UAT)
13. [ ] Staff training
14. [ ] Go-live checklist

### Production Readiness Checklist

**Infrastructure**:
- [ ] Production servers provisioned
- [ ] Load balancer configured
- [ ] SSL certificates installed
- [ ] DNS configured
- [ ] Firewall rules set up

**Security**:
- [ ] Security audit completed
- [ ] Secrets management configured
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Authentication/authorization tested

**Database**:
- [ ] Production database provisioned
- [ ] Automated backups configured
- [ ] Restore procedure tested
- [ ] Database indexes optimized
- [ ] Connection pooling tuned

**Monitoring**:
- [ ] APM configured
- [ ] Alert rules set up
- [ ] Dashboard created
- [ ] Log aggregation configured
- [ ] On-call rotation established

**Testing**:
- [ ] All modules pass >95% load tests
- [ ] User acceptance testing complete
- [ ] Security penetration testing complete
- [ ] Disaster recovery tested

**Documentation**:
- [ ] API documentation complete
- [ ] User guides written
- [ ] Operations runbook created
- [ ] Troubleshooting guide written
- [ ] Deployment procedures documented

**Training**:
- [ ] Staff trained on new system
- [ ] Admin users trained
- [ ] Support team trained
- [ ] Training materials created

### Go-Live Approval

**Approved By**:
- [ ] Development Team
- [ ] QA Team
- [ ] Security Team
- [ ] Operations Team
- [ ] Business Owner

**Go-Live Date**: TBD

---

## Summary - Current Priorities

### 🔴 CRITICAL (Do Now)

1. **Issue #1**: Fix Quote Module Routing Errors (405) - 2-3 hours
2. **Issue #2**: Fix Quote Module Resource Lookup Errors (404) - 3-4 hours
3. **Issue #3**: Fix Quote Module Validation Errors (422) - 2-3 hours

**Total Estimated Effort**: 7-10 hours
**Blocking**: Quote module production deployment

### 🟠 HIGH (Do Next)

4. **Issue #4**: Deploy Microsecond Timestamp Fix - 2 hours
5. **Issue #8**: Fix Shopify Authentication - 1-2 hours (after user verification)
6. **Issue #5**: Investigate and Fix Internal Server Errors - 3-4 hours

**Total Estimated Effort**: 6-8 hours
**Blocking**: High concurrency, Shopify integration

### 🟡 MEDIUM (Do Soon)

7. **Issue #6**: Optimize Database Indexes - 2 hours
8. **Issue #7**: Setup Production Monitoring - 4 hours
9. **Issue #9**: Shopify Product Sync - 6-8 hours (after Issue #8)
10. **Issue #10**: Shopify Inventory Sync - 4-6 hours (after Issue #9)

**Total Estimated Effort**: 16-18 hours
**Impact**: Performance, observability, integrations

---

## Total Effort Summary

**Critical Issues**: 7-10 hours
**High Priority Issues**: 6-8 hours
**Medium Priority Issues**: 16-18 hours

**Total Estimated Effort**: 29-36 hours (approximately 1 week of focused development)

---

**Document Generated**: January 27, 2026 11:30 AM
**Purpose**: Import all issues into Linear for complete visibility
**Author**: Claude Code - Autonomous Development Framework
