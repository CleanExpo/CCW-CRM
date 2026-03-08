# Linear Issues from Master Audit Report
## Generated: February 12, 2026

This document contains prioritized Linear issues based on the Master Audit Report findings. Import these into Linear as new issues with the specified priority, labels, and estimates.

---

## 🔥 P0 - CRITICAL (Must Fix Before Production)

### ISS-031: Fix Order Creation Performance Bottleneck

**Priority**: P0 - Critical
**Labels**: performance, database, backend
**Estimate**: 3 days
**Impact**: HIGH - 6.2% order timeout rate under load

**Description**:
Order creation has P95 response time of 34.8 seconds under 20 concurrent users, with 31 timeouts in 500 scenarios (6.2% failure rate). This is 3,380% slower than the <1s target.

**Root Cause**:
- Order line items not batched (5+ database round-trips per order)
- Individual INSERT statements for each line item
- No bulk insert implementation

**Acceptance Criteria**:
- [ ] Implement bulk insert for order_items table
- [ ] Implement bulk insert for quote_items table
- [ ] Add database transaction batching
- [ ] P95 response time < 1 second
- [ ] Re-run ISS-030 load test
- [ ] Timeout rate < 1%
- [ ] Document optimization approach

**Technical Details**:
```python
# Current (SLOW):
for item in order_data.items:
    order_item = OrderItemModel(...)
    db.add(order_item)
    await db.flush()  # 5+ round-trips

# Target (FAST):
order_items = [OrderItemModel(...) for item in order_data.items]
db.add_all(order_items)
await db.flush()  # 1 round-trip
```

**Files to Modify**:
- `apps/backend/src/api/routes/orders.py` (create_order function)
- `apps/backend/src/api/routes/quotes.py` (create_quote function)

**Testing**:
- Run load test: `cd tests/load-testing && k6 run scenarios/orders-only.js`
- Verify P95 < 1s
- Verify timeout rate < 1%

**Related Issues**: ISS-030 (load testing)

---

### ISS-032: Add Docker Resource Limits to All Services

**Priority**: P0 - Critical
**Labels**: infrastructure, docker, devops
**Estimate**: 4 hours
**Impact**: HIGH - Risk of resource exhaustion crash

**Description**:
All Docker containers lack CPU/memory limits. Any container can consume 100% of host resources, risking cascading failures if a memory leak occurs.

**Root Cause**:
- No `deploy.resources` configured in docker-compose.yml
- No restart policies configured
- No resource monitoring/alerts

**Acceptance Criteria**:
- [ ] Add CPU limits to all 5 services (backend, db, redis, prometheus, grafana)
- [ ] Add memory limits to all 5 services
- [ ] Add resource reservations (minimum guaranteed)
- [ ] Add restart policies (`unless-stopped`)
- [ ] Test resource exhaustion scenarios
- [ ] Document resource requirements
- [ ] Add resource usage alerts in Prometheus

**Technical Details**:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: unless-stopped
```

**Files to Modify**:
- `docker-compose.yml`
- `monitoring/prometheus/alerts.yml` (add ResourceUsageHigh alert)

**Testing**:
- Run resource stress test
- Verify container restarts on OOM
- Verify Prometheus alerts trigger at 80% memory

---

### ISS-033: Build Production CI/CD Deployment Pipeline

**Priority**: P0 - Critical
**Labels**: devops, ci-cd, deployment
**Estimate**: 2 days
**Impact**: HIGH - Manual deployment = high error risk

**Description**:
No automated deployment pipeline exists. All deployments are manual, increasing risk of human error, inconsistent deployments, and slow release cycles.

**Current State**:
- ✅ Tests run in CI (backend, frontend, E2E)
- ❌ No Docker build/push
- ❌ No staging deployment
- ❌ No production deployment
- ❌ No rollback procedure
- ❌ No smoke tests

**Acceptance Criteria**:
- [ ] Add Docker build job to CI
- [ ] Add Docker image scanning (Trivy/Snyk)
- [ ] Add Docker push to registry (GitHub/Docker Hub)
- [ ] Add staging deployment job
- [ ] Add smoke tests for staging
- [ ] Add production deployment job (manual trigger)
- [ ] Add health check gates
- [ ] Document deployment procedure
- [ ] Document rollback procedure
- [ ] Test full deployment pipeline end-to-end

**Technical Details**:
- Use GitHub Actions (already partially configured)
- Build multi-arch images (linux/amd64, linux/arm64)
- Tag images with git SHA + version
- Deploy to staging automatically on main branch
- Deploy to production via manual approval

**Files to Create/Modify**:
- `.github/workflows/deploy-staging.yml` (NEW)
- `.github/workflows/deploy-production.yml` (NEW)
- `.github/workflows/ci.yml` (modify - add Docker build)
- `scripts/deploy.sh` (NEW)
- `scripts/rollback.sh` (NEW)
- `docs/DEPLOYMENT.md` (update)

**Testing**:
- Deploy to staging environment
- Run smoke tests
- Verify health checks
- Test rollback procedure

---

### ISS-034: Implement Secrets Management (Remove Plain-Text Passwords)

**Priority**: P0 - Critical
**Labels**: security, infrastructure, secrets
**Estimate**: 4 hours
**Impact**: HIGH - Credentials exposed in repository

**Description**:
Database password and other secrets are stored in plain text in `docker-compose.yml`, risking exposure through Git commits, CI logs, and unauthorized access.

**Current Issues**:
- ❌ Database password: `'postgres_password'` in plain text
- ❌ No Docker secrets usage
- ❌ No secrets rotation capability
- ⏳ SMTP_PASSWORD not set
- ⏳ SLACK_WEBHOOK_URL not set
- ⏳ SENTRY_DSN not set

**Acceptance Criteria**:
- [ ] Remove plain-text passwords from docker-compose.yml
- [ ] Implement Docker secrets for all sensitive values
- [ ] OR implement AWS Secrets Manager integration
- [ ] Rotate database password
- [ ] Update .env.example files without real secrets
- [ ] Add secrets rotation documentation
- [ ] Test deployment with new secrets management
- [ ] Verify no secrets in Git history

**Technical Details**:
```yaml
# docker-compose.yml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

**Files to Modify**:
- `docker-compose.yml`
- `.gitignore` (add secrets/)
- `docs/SECRETS-MANAGEMENT.md` (NEW)
- `scripts/rotate-secrets.sh` (NEW)

**Testing**:
- Deploy with Docker secrets
- Verify database connection works
- Verify secrets not in Git
- Test secret rotation procedure

---

### ISS-035: Implement Xero OAuth Token Auto-Refresh

**Priority**: P0 - Critical
**Labels**: integration, xero, backend
**Estimate**: 1 day
**Impact**: HIGH - Integration breaks after 24 hours

**Description**:
Xero OAuth tokens expire after 24 hours. No auto-refresh logic exists, causing the Xero integration to break silently until manually fixed.

**Root Cause**:
- No token refresh background job
- No token expiry monitoring
- No webhook for token revocation

**Acceptance Criteria**:
- [ ] Add token refresh background job (runs every 20 hours)
- [ ] Add token expiry monitoring (alert if token expires in <2 hours)
- [ ] Add token refresh endpoint for manual trigger
- [ ] Add token revocation webhook handling
- [ ] Test token refresh flow end-to-end
- [ ] Document token refresh procedure
- [ ] Add Prometheus alert for TokenExpiringS oon

**Technical Details**:
```python
# Background job (FastAPI BackgroundTasks or Celery)
async def refresh_xero_tokens():
    connections = await db.execute(
        select(XeroConnection).where(
            XeroConnection.expires_at < datetime.now(timezone.utc) + timedelta(hours=2)
        )
    )
    for conn in connections.scalars():
        new_tokens = await xero_client.refresh_token(conn.refresh_token)
        conn.access_token = new_tokens["access_token"]
        conn.refresh_token = new_tokens["refresh_token"]
        conn.expires_at = datetime.now(timezone.utc) + timedelta(seconds=new_tokens["expires_in"])
    await db.commit()
```

**Files to Modify**:
- `apps/backend/src/integrations/xero/client.py` (add refresh_token method)
- `apps/backend/src/api/main.py` (add background job scheduler)
- `apps/backend/src/api/routes/integrations/xero.py` (add manual refresh endpoint)
- `monitoring/prometheus/alerts.yml` (add TokenExpiringSoon alert)

**Testing**:
- Mock token expiration
- Verify auto-refresh triggers
- Verify Xero API calls still work after refresh
- Test manual refresh endpoint

**Related**: ISS-008 (Xero auth verification)

---

### ISS-036: Fix Webhook Transaction Boundaries (Prevent Data Loss)

**Priority**: P0 - Critical
**Labels**: integration, data-consistency, backend
**Estimate**: 1 day
**Impact**: HIGH - Lost webhooks if handler crashes

**Description**:
Webhooks are marked as processed BEFORE event handler completes. If handler crashes, webhook is marked processed but event not actually handled, leading to data loss.

**Affected Code**:
1. **Shopify Webhooks** (`shopify/webhooks.py:88-115`)
   - `webhook_log.processed = True` set before handler completes
2. **Xero Payment Webhook** (`xero/webhooks.py:318-322`)
   - Multiple payments processed in loop without transaction boundary

**Acceptance Criteria**:
- [ ] Move `webhook_log.processed = True` inside try block after success (Shopify)
- [ ] Wrap Xero payment loop in database transaction
- [ ] Add webhook retry logic for failed processing
- [ ] Test webhook failure scenarios
- [ ] Verify data consistency after handler crash
- [ ] Document webhook processing flow
- [ ] Add WebhookFailureRate alert

**Technical Details**:
```python
# BEFORE (WRONG):
webhook_log.processed = True
await db.commit()
try:
    await handle_event(payload)
except Exception as e:
    # Too late - already marked processed!
    pass

# AFTER (CORRECT):
try:
    await handle_event(payload)
    webhook_log.processed = True
    await db.commit()
except Exception as e:
    await db.rollback()
    webhook_log.error = str(e)
    await db.commit()
    raise
```

**Files to Modify**:
- `apps/backend/src/integrations/shopify/webhooks.py` (lines 88-115)
- `apps/backend/src/integrations/xero/webhooks.py` (lines 318-322)
- `apps/backend/src/integrations/shopify/product_sync.py` (add compensation logic)
- `monitoring/prometheus/alerts.yml` (add WebhookFailureRate alert)

**Testing**:
- Inject handler crash
- Verify webhook not marked processed
- Verify webhook retries
- Verify data consistency

---

### ISS-037: Add Email Audit Trail (GDPR Compliance)

**Priority**: P0 - Critical
**Labels**: compliance, gdpr, sendgrid, backend
**Estimate**: 2 days
**Impact**: HIGH - GDPR compliance risk, no email visibility

**Description**:
Emails are sent via SendGrid but never logged to database. EmailLog model exists but is unused. This creates GDPR compliance risk (no proof of consent) and no visibility into sent emails.

**Current State**:
- `email_models.py::EmailLog` exists but 0 INSERT statements
- `email_models.py::EmailTemplate` exists but 0 SELECT statements
- SendGrid sends emails successfully
- No delivery/bounce tracking
- No webhook for SendGrid events

**Acceptance Criteria**:
- [ ] Log all outgoing emails to EmailLog table
- [ ] Add SendGrid webhook endpoint (`/api/webhooks/sendgrid`)
- [ ] Handle delivery events (delivered, bounced, opened, clicked)
- [ ] Migrate hardcoded templates to EmailTemplate table
- [ ] Add email audit UI (admin dashboard)
- [ ] Document GDPR compliance
- [ ] Test delivery tracking end-to-end
- [ ] Create email_schemas.py for Pydantic validation

**Technical Details**:
```python
# sendgrid/client.py
async def send_email(...):
    response = await sendgrid_client.send(message)

    # LOG TO DATABASE
    email_log = EmailLog(
        recipient=to_email,
        subject=subject,
        sendgrid_message_id=response.message_id,
        status="sent",
        sent_at=datetime.now(timezone.utc)
    )
    db.add(email_log)
    await db.commit()
```

**Files to Create/Modify**:
- `apps/backend/src/db/email_schemas.py` (NEW)
- `apps/backend/src/integrations/sendgrid/client.py` (add EmailLog integration)
- `apps/backend/src/api/routes/webhooks/sendgrid.py` (NEW)
- `apps/backend/src/api/routes/admin/emails.py` (NEW - email audit UI)
- `docs/GDPR-COMPLIANCE.md` (NEW)

**Testing**:
- Send test email
- Verify EmailLog entry created
- Trigger delivery webhook
- Verify status updated
- Check admin email audit UI

---

### ISS-038: Generate Pydantic Schemas for 141 Missing Tables

**Priority**: P0 - Critical (Phase 1: Priority tables) / P1 (Phase 2: All tables)
**Labels**: backend, data-integrity, type-safety
**Estimate**: 2-3 days
**Impact**: HIGH - No validation for 92% of database tables

**Description**:
Only 13 of 152 database tables (8.5%) have Pydantic schemas. API routes for 141 tables have no request validation, no automatic OpenAPI docs, and type safety gaps.

**Impact**:
- ❌ No automatic request validation (SQL injection risk)
- ❌ No automatic OpenAPI/Swagger docs
- ❌ Type safety gaps throughout API layer
- ❌ No runtime type checking
- ❌ Difficult to maintain API contracts

**Phase 1 Priority** (Day 1-2):
- [ ] shopify_models.py (5 tables)
- [ ] xero_models.py (4 tables)
- [ ] inventory_models.py (9 tables)
- [ ] i18n_models.py (7 tables)
- **Total**: 25 critical tables

**Phase 2 Remaining** (Day 3):
- [ ] ai_models.py (8 tables)
- [ ] pos_models.py (6 tables)
- [ ] ap2_models.py (5 tables) - IF keeping AP2
- [ ] And 8 more model files (~100 tables)

**Acceptance Criteria**:
- [ ] Create schema files for all model files
- [ ] Generate using automated SQLAlchemy → Pydantic script
- [ ] Update API routes to use new schemas
- [ ] Verify OpenAPI docs auto-generate
- [ ] Test validation on all endpoints
- [ ] Document schema generation process

**Technical Approach**:
1. Use automated script to generate base schemas from SQLAlchemy models
2. Manually refine generated schemas (add validators, custom logic)
3. Update API routes to use new schemas
4. Test validation thoroughly

**Files to Create**:
- `apps/backend/src/db/shopify_schemas.py` (NEW)
- `apps/backend/src/db/xero_schemas.py` (NEW)
- `apps/backend/src/db/inventory_schemas.py` (NEW)
- `apps/backend/src/db/i18n_schemas.py` (NEW)
- `apps/backend/src/db/ai_schemas.py` (NEW)
- `apps/backend/src/db/pos_schemas.py` (NEW)
- `scripts/generate-schemas.py` (NEW - automation script)

**Testing**:
- Send invalid data to endpoints
- Verify 422 validation errors
- Check OpenAPI docs at /docs
- Verify type hints work in IDE

**Related**: ISS-041 (schema drift), ISS-042 (API validation)

---

## ⚠️ P1 - HIGH PRIORITY (Fix This Sprint)

### ISS-039: Import Grafana Dashboards (Visualize Metrics)

**Priority**: P1 - High
**Labels**: monitoring, grafana, devops
**Estimate**: 4-6 hours
**Impact**: MEDIUM - Metrics collected but not visualized

**Description**:
Prometheus/Grafana deployed on February 2, but zero dashboards configured (10 days later). Metrics are being collected but cannot be visualized, limiting observability.

**Recommended Dashboards**:
1. **FastAPI Application Metrics** (ID: 16455)
   - Request rate, response time, error rate
   - Endpoint performance breakdown
   - Active requests, queue length

2. **PostgreSQL Database** (ID: 9628)
   - Connections, transactions, cache hit ratio
   - Query performance, slow queries
   - Table sizes, index usage

3. **Docker Container Monitoring** (ID: 893)
   - Container CPU, memory, network, disk I/O
   - Container health, restart count

4. **Business Metrics** (Custom)
   - Orders created/completed per hour
   - Revenue by location
   - Inventory levels by warehouse
   - Quote conversion rate

**Acceptance Criteria**:
- [ ] Import FastAPI dashboard from Grafana.com
- [ ] Import PostgreSQL dashboard from Grafana.com
- [ ] Import Docker dashboard from Grafana.com
- [ ] Create custom Business Metrics dashboard
- [ ] Configure data sources
- [ ] Test dashboard visualization
- [ ] Document dashboard usage
- [ ] Share dashboard URLs with team

**Files to Create**:
- `monitoring/grafana/dashboards/` (directory)
- `monitoring/grafana/dashboards/fastapi.json` (imported)
- `monitoring/grafana/dashboards/postgresql.json` (imported)
- `monitoring/grafana/dashboards/docker.json` (imported)
- `monitoring/grafana/dashboards/business-metrics.json` (custom)
- `docs/MONITORING.md` (update with dashboard info)

**Testing**:
- Access Grafana at http://localhost:3001
- Verify all dashboards load
- Verify metrics display correctly
- Test dashboard drill-downs

**Related**: ISS-019 (monitoring setup), ISS-020 (alert rules)

---

### ISS-040: Configure Sentry DSN (Enable Error Tracking)

**Priority**: P1 - High
**Labels**: monitoring, sentry, error-tracking
**Estimate**: 2 hours
**Impact**: MEDIUM - Production errors not captured

**Description**:
Sentry integration 95% complete (SDK installed, config files created), but DSN values not configured. Error tracking is offline until DSN is set.

**Current State**:
- ✅ Backend SDK installed (sentry-sdk==2.52.0)
- ✅ Frontend SDK installed (@sentry/nextjs)
- ✅ Configuration files created (4 files)
- ✅ Source maps enabled
- ❌ DSN not configured
- ❌ Error tracking offline

**Acceptance Criteria**:
- [ ] Create Sentry project for backend
- [ ] Create Sentry project for frontend
- [ ] Configure SENTRY_DSN in backend .env
- [ ] Configure NEXT_PUBLIC_SENTRY_DSN in frontend .env
- [ ] Test error capture (backend & frontend)
- [ ] Configure Sentry alert rules
- [ ] Set up Slack/email notifications
- [ ] Document Sentry usage

**Technical Details**:
1. Visit https://sentry.io/
2. Create organization (if needed)
3. Create two projects: "ccw-erp-backend", "ccw-erp-frontend"
4. Copy DSN from project settings
5. Add to .env files:
```bash
# Backend .env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Frontend .env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Files to Modify**:
- `apps/backend/.env.production`
- `apps/web/.env.local`
- `apps/web/.env.production`

**Testing**:
- Trigger test error in backend (divide by zero)
- Trigger test error in frontend (throw new Error)
- Verify errors appear in Sentry dashboard
- Verify source maps work (stack traces show original code)

**Related**: ISS-021 (Sentry integration complete)

---

### ISS-041: Fix Redis Metrics Collection

**Priority**: P1 - High
**Labels**: monitoring, redis, infrastructure
**Estimate**: 2 hours
**Impact**: MEDIUM - Cache performance unknown

**Description**:
Redis exporter not in Docker network, preventing cache metrics collection. Cannot measure cache hit/miss rates, memory usage, or performance.

**Current State**:
- Redis: Running, 100% uptime
- redis-exporter: ❌ Not in Docker network
- Cache hit rate: ❓ Unknown
- Cache memory usage: ❓ Unknown

**Acceptance Criteria**:
- [ ] Add redis-exporter to docker-compose.yml
- [ ] Configure redis-exporter to connect to Redis
- [ ] Add redis-exporter to Prometheus scrape targets
- [ ] Verify Redis metrics in Prometheus
- [ ] Add HighCacheMissRate alert
- [ ] Add Redis memory usage alert
- [ ] Test cache metrics collection

**Technical Details**:
```yaml
# docker-compose.yml
services:
  redis-exporter:
    image: oliver006/redis_exporter:latest
    ports:
      - "9121:9121"
    environment:
      REDIS_ADDR: redis:6379
    networks:
      - app-network
    depends_on:
      - redis
```

**Files to Modify**:
- `docker-compose.yml`
- `monitoring/prometheus/prometheus.yml` (add redis-exporter target)
- `monitoring/prometheus/alerts.yml` (add HighCacheMissRate alert)

**Testing**:
- Start redis-exporter
- Check http://localhost:9121/metrics
- Verify metrics in Prometheus
- Test cache hit/miss scenarios

---

### ISS-042: Fix Order Status Auto-Update on Payment

**Priority**: P1 - High
**Labels**: integration, xero, backend, business-logic
**Estimate**: 4 hours
**Impact**: MEDIUM - Manual order status updates required

**Description**:
When Xero invoice is paid, webhook is received and payment recorded, but order status is not automatically updated. This requires manual intervention.

**Current Flow**:
1. ✅ Order created in ERP
2. ✅ Invoice created in Xero
3. ✅ Payment webhook received from Xero
4. ✅ Payment recorded in database
5. ❌ Order status NOT updated to "paid"/"delivered"

**Target Flow**:
Add step 5: Order status automatically updated when invoice fully paid

**Acceptance Criteria**:
- [ ] Add order status update logic in Xero webhook handler
- [ ] If invoice fully paid → update order.status to "delivered"
- [ ] If invoice partially paid → update order.status to "processing"
- [ ] Store payment details in order record
- [ ] Test invoice → payment → status flow end-to-end
- [ ] Document business logic
- [ ] Add unit tests

**Technical Details**:
```python
# xero/webhooks.py - INVOICE.UPDATE handler
async def handle_invoice_update(payload):
    invoice_id = payload["resourceId"]

    # Fetch invoice from Xero
    invoice = await xero_client.get_invoice(invoice_id)

    # Find order by xero_invoice_id
    order = await db.execute(
        select(Order).where(Order.xero_invoice_id == invoice_id)
    )
    order = order.scalar_one_or_none()

    if order:
        if invoice["amountPaid"] >= invoice["total"]:
            order.status = OrderStatus.DELIVERED
            order.payment_received_at = datetime.now(timezone.utc)
        elif invoice["amountPaid"] > 0:
            order.status = OrderStatus.PROCESSING

        await db.commit()
```

**Files to Modify**:
- `apps/backend/src/integrations/xero/webhooks.py` (add status update logic)
- `apps/backend/tests/integrations/test_xero_webhooks.py` (add tests)
- `docs/BUSINESS-LOGIC.md` (document order status flow)

**Testing**:
- Create order
- Create invoice in Xero
- Mark invoice as paid in Xero
- Verify order status updates automatically

---

### ISS-043: Add Unique Constraints for Shopify Mappings

**Priority**: P1 - High
**Labels**: database, data-integrity, shopify
**Estimate**: 4 hours
**Impact**: MEDIUM - Risk of duplicate mappings

**Description**:
No unique constraint on `(product_id, shopify_product_id)` in shopify_product_mappings table. Concurrent webhook + manual sync can create duplicate mappings.

**Root Cause**:
- Webhook processing + manual sync can run simultaneously
- No unique constraint prevents duplicates
- No ON CONFLICT handling

**Acceptance Criteria**:
- [ ] Create Alembic migration to add unique constraint
- [ ] Add unique constraint on (product_id, shopify_product_id)
- [ ] Add unique constraint on (order_id, shopify_order_id)
- [ ] Update insert logic to use ON CONFLICT DO UPDATE
- [ ] Test concurrent mapping creation
- [ ] Verify no duplicate mappings possible
- [ ] Document migration procedure

**Technical Details**:
```sql
-- Migration
ALTER TABLE shopify_product_mappings
ADD CONSTRAINT unique_product_shopify_mapping
UNIQUE (product_id, shopify_product_id);

ALTER TABLE shopify_order_mappings
ADD CONSTRAINT unique_order_shopify_mapping
UNIQUE (order_id, shopify_order_id);
```

```python
# Python code with ON CONFLICT
stmt = insert(ShopifyProductMapping).values(
    product_id=product.id,
    shopify_product_id=shopify_id
).on_conflict_do_update(
    index_elements=['product_id', 'shopify_product_id'],
    set_={'updated_at': datetime.now(timezone.utc)}
)
```

**Files to Create/Modify**:
- `apps/backend/migrations/versions/xxx_add_shopify_unique_constraints.py` (NEW)
- `apps/backend/src/integrations/shopify/product_sync.py` (add ON CONFLICT handling)
- `apps/backend/src/integrations/shopify/order_sync.py` (add ON CONFLICT handling)

**Testing**:
- Run migration
- Attempt to create duplicate mapping
- Verify constraint prevents duplicate
- Test ON CONFLICT behavior

---

### ISS-044: Profile and Optimize Database Queries Under Load

**Priority**: P1 - High
**Labels**: performance, database, backend
**Estimate**: 3 days
**Impact**: HIGH - All modules slow under concurrent load

**Description**:
All modules (Products, Customers, Quotes) have P95 response times 18-20x slower than targets under 20 concurrent users. Database query times spike to 6-9 seconds.

**Current Performance**:
- Products P95: 9.1s (target: <500ms) - 18x slower
- Customers P95: 9.9s (target: <500ms) - 20x slower
- Quotes P95: 9.9s (target: <500ms) - 20x slower

**Acceptance Criteria**:
- [ ] Profile database queries under 20+ concurrent users
- [ ] Identify slow queries (>500ms)
- [ ] Optimize identified slow queries
- [ ] Add database indexes where needed
- [ ] Test query performance under load
- [ ] Verify P95 < 500ms for all modules
- [ ] Document optimization approach
- [ ] Add slow query monitoring

**Technical Approach**:
1. Enable PostgreSQL slow query log (log queries >500ms)
2. Run load test with 50 concurrent users
3. Analyze pg_stat_statements for slow queries
4. Add missing indexes
5. Rewrite inefficient queries
6. Re-test under load

**Tools**:
- pg_stat_statements
- EXPLAIN ANALYZE
- Load testing (k6)
- Prometheus query metrics

**Files to Analyze**:
- `apps/backend/src/api/routes/products.py`
- `apps/backend/src/api/routes/customers.py`
- `apps/backend/src/api/routes/quotes.py`
- All database models

**Testing**:
- Run load test: `k6 run scenarios/all-modules.js --vus 50`
- Verify P95 < 500ms
- Verify pass rate > 95%

**Related**: ISS-031 (order optimization), ISS-017 (query tuning complete)

---

## 🟡 P2 - MEDIUM PRIORITY (Next Sprint)

### ISS-045: Implement Background Job Queue for Webhooks

**Priority**: P2 - Medium
**Labels**: infrastructure, backend, reliability
**Estimate**: 5 days
**Impact**: MEDIUM - Webhook processing reliability

**Description**:
Webhooks processed synchronously, blocking requests. No retry logic for failed webhooks. Need background job queue for reliability and scalability.

**Current State**:
- Webhooks processed in request handler (blocking)
- No retry for failed webhooks
- No job queue

**Target State**:
- Webhooks added to job queue (non-blocking)
- Automatic retry with exponential backoff
- Dead letter queue for permanently failed jobs

**Acceptance Criteria**:
- [ ] Choose job queue system (Celery or FastAPI BackgroundTasks)
- [ ] Implement webhook job queue
- [ ] Add retry logic (3 retries, exponential backoff)
- [ ] Add dead letter queue
- [ ] Add job monitoring UI
- [ ] Test failure scenarios
- [ ] Document job queue architecture

**Recommended**: FastAPI BackgroundTasks (simpler) or Celery (production-grade)

**Effort**: 5 days
- Day 1: Setup job queue infrastructure
- Day 2: Migrate webhook handlers to jobs
- Day 3: Implement retry logic
- Day 4: Add monitoring/UI
- Day 5: Testing & documentation

---

### ISS-046: Add Admin UI for Manual Sync Operations

**Priority**: P2 - Medium
**Labels**: frontend, admin, integrations
**Estimate**: 3 days
**Impact**: MEDIUM - No recovery from webhook failures

**Description**:
If webhooks fail, no UI to trigger manual sync. Must use SQL/API directly.

**Acceptance Criteria**:
- [ ] Create admin integrations page
- [ ] Add "Sync Shopify Products" button
- [ ] Add "Sync Xero Customers" button
- [ ] Add "Replay Webhook" interface
- [ ] Add sync status indicators
- [ ] Add sync history log
- [ ] Test manual sync operations

**Files to Create**:
- `apps/web/app/(dashboard)/admin/integrations/page.tsx` (NEW)
- `apps/web/lib/api/integrations.ts` (add manual sync methods)

---

### ISS-047: Implement Uptime Monitoring

**Priority**: P2 - Medium
**Labels**: monitoring, devops, reliability
**Estimate**: 4 hours
**Impact**: MEDIUM - Cannot detect outages from user perspective

**Description**:
No external uptime monitoring. Cannot detect outages from outside the system.

**Acceptance Criteria**:
- [ ] Configure UptimeRobot or Pingdom
- [ ] Monitor critical endpoints (login, orders, products)
- [ ] Set up synthetic monitoring for user journeys
- [ ] Create public status page
- [ ] Configure incident notifications (email, Slack)
- [ ] Test alerting

---

### ISS-048: Complete or Remove Google AP2 Integration

**Priority**: P2 - Medium (Decision Required)
**Labels**: integration, ap2, product-decision
**Estimate**: 1-2 weeks (complete) OR 1 day (remove)
**Impact**: MEDIUM - Incomplete feature in codebase

**Description**:
Google AP2 integration 20% complete (models exist, but no working implementation). Need product decision: complete or remove.

**Option A: Complete (1-2 weeks)**
- Implement AP2LiveClient
- Implement security module
- Add webhook handlers
- Create Pydantic schemas
- Build frontend integration
- Test payment flows

**Option B: Remove (1 day)**
- Delete ap2_models.py
- Delete ap2/ integration folder
- Delete ap2 routes
- Clean up references
- Update documentation

**Decision Required From**: Product/Business lead

---

### ISS-049: Add Log Aggregation (Loki + Promtail)

**Priority**: P2 - Medium
**Labels**: monitoring, logging, devops
**Estimate**: 1 day
**Impact**: MEDIUM - Difficult to troubleshoot distributed issues

**Description**:
Logs only go to stdout (Docker logs). Need centralized logging for production troubleshooting.

**Acceptance Criteria**:
- [ ] Deploy Loki
- [ ] Deploy Promtail
- [ ] Configure log collection from all containers
- [ ] Add Loki as Grafana data source
- [ ] Create log dashboard
- [ ] Test log search/filtering

---

### ISS-050: Fix mypy Type Checking (Re-enable in CI)

**Priority**: P2 - Medium
**Labels**: backend, type-safety, technical-debt
**Estimate**: 2-3 days
**Impact**: MEDIUM - Type errors not caught in CI

**Description**:
mypy disabled in CI with TODO comment "Fix mypy errors and re-enable". Type checking not enforced.

**Acceptance Criteria**:
- [ ] Run mypy locally, identify all errors
- [ ] Fix all type errors
- [ ] Re-enable mypy in CI
- [ ] Configure mypy strict mode
- [ ] Add pre-commit hook for mypy
- [ ] Document type checking standards

---

## 🟢 P3 - LOW PRIORITY (Backlog)

### ISS-051: Frontend Bundle Size Analysis

**Priority**: P3 - Low
**Labels**: frontend, performance, optimization
**Estimate**: 2 days
**Impact**: LOW - Bundle size unknown

**Description**:
Frontend bundle size not measured. May cause slow page loads.

**Acceptance Criteria**:
- [ ] Configure webpack-bundle-analyzer
- [ ] Analyze production bundle
- [ ] Identify large dependencies
- [ ] Implement code splitting
- [ ] Add bundle size CI check
- [ ] Target: <500KB initial bundle

---

### ISS-052: Accessibility Compliance (WCAG 2.1 AA)

**Priority**: P3 - Low
**Labels**: frontend, accessibility, compliance
**Estimate**: 4 weeks
**Impact**: LOW - 15+ WCAG violations identified

**Description**:
UX audit identified 15+ WCAG 2.1 AA violations. Need 4-week sprint to fix.

**Violations** (Sample):
- Missing alt text (23 images)
- Color contrast failures (12 locations)
- No keyboard navigation for modals
- Missing ARIA labels (18 elements)
- Form errors not announced

**Acceptance Criteria**:
- [ ] Fix all WCAG 2.1 AA violations
- [ ] Add automated accessibility testing
- [ ] Document accessibility guidelines
- [ ] Train team on accessibility

---

### ISS-053: Dead Code Cleanup

**Priority**: P3 - Low
**Labels**: technical-debt, refactoring
**Estimate**: 2 days
**Impact**: LOW - Code confusion, maintainability

**Description**:
3,335 debug statements, 1,981 TODO comments, 30 disabled files, unused models.

**Acceptance Criteria**:
- [ ] Remove or resolve all TODO/FIXME comments
- [ ] Remove debug console.log/print statements
- [ ] Delete .disabled/.bak/.old files
- [ ] Remove unused models (email_models, submission_notes)
- [ ] Remove commented-out code
- [ ] Document cleanup

---

### ISS-054: Database Read Replicas for Analytics

**Priority**: P3 - Low
**Labels**: database, scalability, performance
**Estimate**: 1 week
**Impact**: LOW - Offload reporting queries

**Description**:
All queries hit primary database. Analytics queries slow down production.

**Acceptance Criteria**:
- [ ] Set up PostgreSQL read replica
- [ ] Configure replication
- [ ] Route analytics queries to replica
- [ ] Monitor replication lag
- [ ] Test failover

---

### ISS-055: Horizontal Scaling (Multiple Backend Instances)

**Priority**: P3 - Low
**Labels**: scalability, infrastructure, devops
**Estimate**: 2 weeks
**Impact**: LOW - Prepare for >100 concurrent users

**Description**:
Single backend instance. Need horizontal scaling for >100 users.

**Acceptance Criteria**:
- [ ] Test multiple backend instances
- [ ] Implement session affinity (if needed)
- [ ] Set up load balancer (ALB/nginx)
- [ ] Test auto-scaling
- [ ] Document scaling procedure

---

## Summary Statistics

**Total Issues Created**: 55
- 🔥 P0 - Critical: 8 issues (2 weeks effort)
- ⚠️ P1 - High: 8 issues (1 week effort)
- 🟡 P2 - Medium: 7 issues (2 weeks effort)
- 🟢 P3 - Low: 5 issues (ongoing)

**Critical Path** (Phase 1 - 2 weeks):
1. ISS-031: Order performance (3 days)
2. ISS-032: Docker limits (4 hours)
3. ISS-033: CI/CD pipeline (2 days)
4. ISS-034: Secrets management (4 hours)
5. ISS-035: Xero token refresh (1 day)
6. ISS-036: Webhook transactions (1 day)
7. ISS-037: Email audit trail (2 days)
8. ISS-038: Pydantic schemas Phase 1 (2 days)

**Labels Used**:
- performance, database, backend, infrastructure, docker, devops, ci-cd, deployment
- security, secrets, integration, xero, shopify, sendgrid, data-consistency
- compliance, gdpr, monitoring, grafana, sentry, error-tracking, redis
- frontend, admin, accessibility, type-safety, technical-debt
- scalability, logging, testing

**Import Instructions**:
1. Create new Linear project: "Production Readiness Sprint"
2. Import issues with priorities (P0 → Urgent, P1 → High, P2 → Medium, P3 → Low)
3. Assign to Phase 1 milestone (2 weeks)
4. Track progress with Linear status workflow
5. Use labels for filtering and organization

---

**Generated**: February 12, 2026
**Source**: Master Audit Report (MASTER-AUDIT-REPORT-2026-02-12.md)
**Next Review**: After Phase 1 completion (2 weeks)
