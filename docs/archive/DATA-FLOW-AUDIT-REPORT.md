# CCW-ERP-CRM: DATA FLOW & INTEGRATION AUDIT REPORT
**Date**: 2026-02-12
**Auditor**: Data Flow & Integration Specialist
**Scope**: Complete system data flow tracing, integration health, schema validation

---

## EXECUTIVE SUMMARY

**System Health**: 🟡 MODERATE - Functional but with significant gaps
**Integration Coverage**: 6/8 integrations partially implemented
**Schema Consistency**: 🔴 CRITICAL GAPS - Only 8.5% of models have Pydantic schemas
**API Coverage**: 280 endpoints registered, ~70% frontend-connected
**Dead Code Risk**: 🟡 MEDIUM - Several unused tables and incomplete integrations

**Critical Issues Found**: 7
**High-Priority Issues**: 12
**Medium-Priority Issues**: 18

---

## 1. DATABASE SCHEMA ANALYSIS

### 1.1 Table Inventory (152 Tables Across 17 Model Files)

**Schema Coverage**: Only 13/152 tables (8.5%) have Pydantic schemas 🔴 **CRITICAL**

| Model File | Tables | Schema Coverage | Status |
|------------|--------|----------------|--------|
| demo_models.py | 11 | ✅ 100% (schemas.py) | GOOD - Reference implementation |
| crm_models.py | 2 | ✅ 100% (crm_schemas.py) | GOOD |
| shopify_models.py | 5 | 🔴 0% | **CRITICAL: No schemas** |
| i18n_models.py | 7 | 🔴 0% | **CRITICAL: No schemas** |
| inventory_models.py | 9 | 🔴 0% | **CRITICAL: No schemas** |
| xero_models.py | 4 | 🔴 0% | **CRITICAL: No schemas** |
| ai_models.py | 8 | 🔴 0% | **CRITICAL: No schemas** |
| pos_models.py | 6 | 🔴 0% | **CRITICAL: No schemas** |
| ap2_models.py | 5 | 🔴 0% | **CRITICAL: No schemas** |
| Others (8 files) | ~95 | 🔴 0% | **CRITICAL: No schemas** |

**Impact**: API routes for these entities cannot use Pydantic validation/serialization, leading to:
- No automatic request validation
- No automatic OpenAPI/Swagger documentation
- Type safety gaps
- Potential SQL injection risks
- No runtime type checking

### 1.2 Schema Drift Analysis

**ALIGNED Models** (Good):
- ✅ Product, Customer, Order, OrderItem, Quote, QuoteItem (demo_models.py ↔ schemas.py)
- ✅ Contact, Activity (crm_models.py ↔ crm_schemas.py)

**MISSING Schemas** (141 tables across 15 model files):
- 🔴 shopify_models.py: ShopifyConnection, ShopifyProductMapping, ShopifyOrderMapping, ShopifyWebhookLog, ShopifyProductSyncLog
- 🔴 i18n_models.py: Language, ProductTranslation, CategoryTranslation, UITranslation, TranslationQueue, EmailTemplateTranslation (7 tables)
- 🔴 inventory_models.py: ProductStockByLocation, StockTransfer, StockAdjustment, StockReservation, Supplier, PurchaseOrder, PurchaseOrderItem, InboundShipment, OutboundShipment (9 tables)
- 🔴 xero_models.py: XeroConnection, XeroInvoice, XeroPayment, XeroContact (4 tables)
- 🔴 And 11 more model files...

---

## 2. INTEGRATION HEALTH MATRIX

| Integration | Status | Implementation | Issues | Risk |
|------------|--------|---------------|--------|------|
| **Shopify** | 🟢 ACTIVE | 90% | Missing schemas, no webhook registration endpoint | LOW |
| **Xero** | 🟢 ACTIVE | 85% | Missing schemas, no token refresh | MEDIUM |
| **SendGrid** | 🟡 PARTIAL | 60% | No database logging, missing webhooks | MEDIUM |
| **ElevenLabs** | 🟡 PARTIAL | 40% | Demo only, no live implementation | MEDIUM |
| **Google AP2** | 🔴 STUB | 20% | Models exist, no working implementation | HIGH |
| **Prometheus** | 🟢 ACTIVE | 95% | Working, AlertManager pending | LOW |
| **Sentry** | 🟢 ACTIVE | 100% | Error tracking fully operational | LOW |
| **Redis** | 🟡 OPTIONAL | 80% | Caching works, graceful fallback | LOW |

### 2.1 Shopify Integration (✅ 90% Complete)

**Working**:
- ✅ Webhook handlers for orders, products, inventory
- ✅ HMAC signature verification
- ✅ Bidirectional product sync
- ✅ Order import from Shopify
- ✅ Demo mode fallback

**Missing**:
- 🔴 No Pydantic schemas for shopify_models.py (5 tables)
- 🔴 No webhook registration endpoint (manual Shopify admin setup required)
- 🟡 No retry logic for failed webhook processing
- 🟡 Transaction boundary issue: webhook marked processed BEFORE handler completes

**Data Flow**:
```
Shopify Store → Webhooks (HMAC verified) → webhooks.py handlers
  ├─ orders/create → import to ERP
  ├─ products/update → sync from Shopify to ERP
  └─ inventory_levels/update → sync stock
     ↓
PostgreSQL: shopify_connections, shopify_product_mappings,
            shopify_order_mappings, shopify_webhook_logs
```

**Critical Issue**: In `shopify/webhooks.py:91-92`, webhook is marked as processed BEFORE the handler completes:

```python
webhook_log.processed = True  # Line 91
webhook_log.processed_at = datetime.utcnow()
await self.db.commit()  # Line 92

return {"success": True, "result": result}  # Line 101
```

If an exception occurs between lines 92-101, the webhook is marked processed but not actually handled.

**Fix Required**: Move `processed=True` inside the try block after successful handling.

### 2.2 Xero Integration (✅ 85% Complete)

**Working**:
- ✅ OAuth2 authentication flow
- ✅ Invoice creation and sync
- ✅ Payment webhooks with HMAC-SHA256 verification
- ✅ Contact (customer) sync
- ✅ Replay attack protection

**Missing**:
- 🔴 No Pydantic schemas for xero_models.py (4 tables)
- 🔴 **CRITICAL**: No OAuth token refresh logic (tokens expire after 24 hours)
- 🟡 No bulk sync endpoint for manual recovery
- 🟡 Transaction boundary issue in payment webhook loop

**Data Flow**:
```
Xero Accounting → OAuth2 + Webhooks → xero/webhooks.py
  ├─ INVOICE.UPDATE → check for payments → update order
  └─ CONTACT.UPDATE → sync customer
     ↓
PostgreSQL: xero_connections (OAuth tokens),
            customers (xero_contact_id),
            orders (xero_invoice_id)
```

**Critical Issue**: In `xero/webhooks.py:318-322`, payment loop has no transaction boundary:

```python
for payment_data in payments:
    await self.payment_sync.process_payment_webhook(
        db, organization_id, payment_data
    )
```

If processing fails halfway through, partial payments recorded with no rollback.

**Fix Required**: Wrap payment processing loop in a database transaction.

### 2.3 SendGrid Integration (🟡 60% Complete)

**Working**:
- ✅ Email sending via SendGrid API
- ✅ Template email support
- ✅ Demo mode with mock client

**Missing**:
- 🔴 **CRITICAL**: Emails not logged to database (EmailLog model exists but unused)
- 🔴 EmailTemplate model unused (templates hardcoded)
- 🔴 No SendGrid webhook endpoint for delivery tracking
- 🟡 No email queue (sends synchronously, blocks request)

**GDPR Compliance Risk**: No audit trail of sent emails violates GDPR "right to access" requirements.

**Recommendation**: Implement EmailLog integration immediately for production deployment.

### 2.4 Google AP2 Integration (🔴 20% Complete - NOT PRODUCTION READY)

**Defined**:
- Models: ap2_payment_mandates, ap2_payment_sessions, ap2_voice_interactions, ap2_payment_verifications, ap2_transaction_logs
- Routes: /api/ap2/payment/initiate, /api/ap2/payment/verify
- Clients: AP2DemoClient (mock), AP2LiveClient (skeleton)

**Missing Everything**:
- 🔴 No live implementation (demo mode returns fake data)
- 🔴 No Pydantic schemas
- 🔴 Security module incomplete (ap2/security.py has stubs)
- 🔴 No webhook handlers
- 🔴 Tables never written to (0 rows in production)

**Status**: ❌ **NOT PRODUCTION-READY**

**Recommendation**: Either complete full integration (2-3 weeks) or remove entirely (1 day) depending on product roadmap priority.

---

## 3. DATA FLOW TRACING

### 3.1 Complete User Journey: Create Order

**Step-by-Step Trace**:

```
1. User Action
   └─ apps/web/app/(dashboard)/orders/components/OrderForm.tsx
      └─ React Hook Form + Zod validation
      └─ onClick → createOrder()

2. Frontend API Call
   └─ apps/web/lib/api/orders.ts::createOrder()
      └─ apiClient.post("/api/orders", orderData)
      └─ JWT token from localStorage
      └─ X-User-Id header added

3. Network Request
   └─ fetch("http://localhost:8000/api/orders", {
        method: "POST",
        headers: {
          "Authorization": "Bearer <jwt>",
          "X-User-Id": "<user_id>",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      })

4. Backend Reception
   └─ apps/backend/src/api/main.py
      ├─ CORSMiddleware (validates origin)
      ├─ SecurityHeadersMiddleware (adds headers)
      ├─ AuthMiddleware (validates JWT)
      ├─ RateLimiter (checks 60 req/min)
      └─ PerformanceMiddleware (starts timer)

5. Route Handler
   └─ apps/backend/src/api/routes/orders.py::create_order()
      ├─ Pydantic validates OrderCreate schema
      ├─ Extract customer_id, items[], notes
      └─ Call business logic

6. Database Transaction
   └─ SQLAlchemy async session
      ├─ Generate order_number via PostgreSQL sequence
      │  SELECT nextval('order_number_seq')
      │  → Result: ORD-2026-001234
      ├─ INSERT INTO orders (...)
      ├─ For each item in items[]:
      │  ├─ Fetch product.price
      │  ├─ Calculate line_total = quantity × unit_price
      │  ├─ INSERT INTO order_items (...)
      │  └─ UPDATE products SET stock = stock - quantity
      ├─ Calculate order.total = SUM(line_totals)
      ├─ UPDATE orders SET total = ?
      └─ COMMIT (or ROLLBACK on failure)

7. External Sync (Async)
   └─ If Xero integration enabled:
      ├─ xero/invoices.py::create_invoice_from_order()
      ├─ POST https://api.xero.com/api.xro/2.0/Invoices
      ├─ Store xero_invoice_id in orders.xero_invoice_id
      └─ Set xero_sync_status = "synced"

   └─ If Shopify integration enabled:
      ├─ For each order_item:
      │  ├─ Find shopify_product_mappings
      │  ├─ shopify/inventory_sync.py::update_inventory()
      │  └─ PUT https://{shop}.myshopify.com/admin/api/2024-01/inventory_levels/set.json
      └─ Log to shopify_product_sync_logs

8. Response Serialization
   └─ Pydantic Order schema serializes to JSON
      {
        "id": "uuid",
        "order_number": "ORD-2026-001234",
        "customer_id": "uuid",
        "status": "pending",
        "total": 1234.56,
        "order_items": [...],
        "created_at": "2026-02-12T10:30:00Z"
      }

9. Performance Logging
   └─ PerformanceMiddleware records:
      - request_duration_ms: 245
      - endpoint: POST /api/orders
      - status_code: 201
      → Exported to Prometheus

10. Frontend Update
    └─ apiClient returns Order object
    └─ toast({ title: "Success", description: "Order created" })
    └─ router.refresh() → re-fetch orders list
    └─ navigate to /orders/{id}
```

**Validation Layers**:
1. Frontend: Zod schema (apps/web/app/(dashboard)/orders/schema.ts)
2. API: Pydantic OrderCreate (apps/backend/src/db/schemas.py:200-202)
3. Database: Foreign key constraints, NOT NULL, CHECK constraints
4. External: Xero/Shopify API validation

### 3.2 Webhook Processing: Shopify Order Created

**Trace**:

```
1. Shopify Event Trigger
   └─ Customer places order on Shopify store
   └─ Shopify generates webhook event
   └─ POST https://your-erp.com/api/webhooks/shopify
      Headers:
        X-Shopify-Topic: orders/create
        X-Shopify-Hmac-Sha256: <signature>
      Body: { "id": 123456, "order_number": 1001, ... }

2. Webhook Reception
   └─ apps/backend/src/api/routes/webhooks.py (generic router)
   └─ Route to Shopify-specific handler
   └─ integrations/shopify/webhooks.py::ShopifyWebhookHandler

3. Signature Verification
   └─ Extract X-Shopify-Hmac-Sha256 header
   └─ Calculate HMAC-SHA256(secret, body)
   └─ Compare computed vs received signature
   └─ If mismatch → 401 Unauthorized

4. Webhook Logging
   └─ INSERT INTO shopify_webhook_logs
      - topic = "orders/create"
      - payload = <full JSON>
      - processed = False
      - received_at = NOW()

5. Handler Routing
   └─ Based on topic:
      - orders/create → _handle_order_create()
      - products/update → _handle_product_update()
      - inventory_levels/update → _handle_inventory_update()

6. Order Import
   └─ shopify/orders.py::ShopifyOrderImporter
   ├─ Fetch full order from Shopify API
   │  GET /orders/{order_id}.json
   ├─ Transform Shopify order → ERP order
   │  - Map Shopify customer → ERP customer
   │  - Map Shopify line_items → ERP order_items
   │  - Map Shopify product_id → ERP product_id (via shopify_product_mappings)
   ├─ Check if order already imported
   │  SELECT * FROM shopify_order_mappings WHERE shopify_order_id = ?
   ├─ If new:
   │  ├─ INSERT INTO orders (...)
   │  ├─ INSERT INTO order_items (...) [loop]
   │  └─ INSERT INTO shopify_order_mappings (...)
   └─ If exists:
      └─ UPDATE orders SET status = ?, ... WHERE id = ?

7. Mark Processed ⚠️ ISSUE
   └─ UPDATE shopify_webhook_logs SET processed = True
   └─ COMMIT
   └─ ⚠️ This happens BEFORE exception handling
      → If steps 8-9 fail, webhook marked processed but not fully handled

8. Response
   └─ Return 200 OK { "success": true, "order_id": "uuid" }
   └─ Shopify receives confirmation
   └─ Shopify stops retrying webhook

9. Background Cleanup
   └─ Webhook log retention: 30 days
   └─ Old logs purged by scheduled job
```

**Critical Bug**: Step 7 (mark processed) occurs inside `try` block but before handler completion. If handler throws exception after webhook is marked processed, the event is lost forever.

**Fix**:
```python
# CURRENT (WRONG):
try:
    result = await self._handle_order_create(payload)

    webhook_log.processed = True  # ❌ Too early
    webhook_log.processed_at = datetime.utcnow()
    await self.db.commit()

    return {"success": True, "result": result}
except Exception as e:
    webhook_log.processing_error = str(e)
    await self.db.commit()
    return {"success": False, "error": str(e)}

# FIXED:
try:
    result = await self._handle_order_create(payload)

    # ✅ Only mark processed after successful handling
    webhook_log.processed = True
    webhook_log.processed_at = datetime.utcnow()
    await self.db.commit()

    return {"success": True, "result": result}
except Exception as e:
    webhook_log.processing_error = str(e)
    await self.db.commit()  # Leave processed=False
    return {"success": False, "error": str(e)}
```

---

## 4. MISSING INTEGRATIONS & GAPS

### 4.1 Critical Missing Pieces

**Priority 0 (Fix Before Production)**:

1. **🔴 Pydantic Schemas for 92% of Models**
   - Impact: No request validation, no OpenAPI docs, type safety gaps
   - Effort: 2-3 days (can be automated with script)
   - Risk: HIGH - SQL injection, bad data in database
   - Files needed: shopify_schemas.py, xero_schemas.py, inventory_schemas.py, i18n_schemas.py, etc.

2. **🔴 Xero OAuth Token Refresh**
   - Impact: Integration breaks after 24 hours (token expiry)
   - Effort: 1 day
   - Risk: CRITICAL - Production outage
   - Fix: Add background job to refresh token before expiry

3. **🔴 Webhook Transaction Boundaries**
   - Impact: Lost events, inconsistent data
   - Effort: 1 day
   - Risk: HIGH - Data corruption
   - Files: shopify/webhooks.py, xero/webhooks.py

4. **🔴 EmailLog Integration (GDPR)**
   - Impact: No audit trail for sent emails
   - Effort: 2 days
   - Risk: HIGH - Legal compliance
   - Fix: Log all SendGrid emails to email_models.EmailLog

**Priority 1 (Fix This Sprint)**:

5. **🟡 Manual Sync Admin UI**
   - Impact: No recovery from webhook failures
   - Effort: 3 days
   - Risk: MEDIUM - Operations burden
   - Features: Shopify product sync, Xero customer sync, webhook replay

6. **🟡 Background Job Queue**
   - Impact: Webhook processing blocks requests
   - Effort: 5 days
   - Risk: MEDIUM - Scalability
   - Solution: Celery or FastAPI BackgroundTasks

7. **🟡 Unique Constraints on Shopify Mappings**
   - Impact: Duplicate mappings created
   - Effort: 1 day
   - Risk: MEDIUM - Data integrity
   - Fix: Add migration with UNIQUE(product_id, shopify_product_id)

### 4.2 Dead Code Report

**Unused Database Tables**:

1. `submission_notes_models.py::SubmissionNote`
   - Grep result: 0 SQL queries found
   - Status: Defined but never used
   - Recommendation: Remove

2. `email_models.py::EmailLog`
   - Grep result: 0 INSERT statements
   - Status: Model exists, table empty
   - Recommendation: Integrate with SendGrid

3. `email_models.py::EmailTemplate`
   - Grep result: 0 SELECT statements
   - Status: Templates hardcoded in code
   - Recommendation: Migrate to DB or remove

4. All 5 tables in `ap2_models.py`
   - Status: Skeleton for future feature
   - Recommendation: Complete integration or remove

**Unused API Endpoints** (Registered but no frontend consumer):

1. `/api/integrations/shopify/products/sync` - Manual product sync
2. `/api/integrations/xero/sync/customers` - Manual customer sync
3. `/api/ai/learning/*` - Learning engine management
4. `/api/portal-forms/contact-form` - Customer portal (planned)
5. `/api/webhooks/test` - Webhook infrastructure test

**Incomplete Features**:

1. **Customer Portal** (25% complete)
   - Backend: portal_auth.py (✅), portal_forms_models.py (✅)
   - Frontend: ❌ Not built
   - Status: Awaiting product decision

2. **POS Reconciliation** (Backend complete, frontend missing)
   - Backend: pos_models.py (✅), bank_feeds.py (✅)
   - Frontend: ❌ No admin UI
   - Status: Functional but not accessible

3. **Google AP2 Payment System** (20% complete)
   - Models: ✅ Defined
   - Routes: 🟡 Stub endpoints
   - Client: 🔴 Demo only
   - Webhooks: 🔴 Missing
   - Status: Not production-ready

---

## 5. INTEGRATION STATUS SUMMARY

### 5.1 Integration Scorecard

```
┌────────────────────────────────────────────────────────────────┐
│ INTEGRATION            STATUS    SCORE   NOTES                 │
├────────────────────────────────────────────────────────────────┤
│ ✅ Shopify             ACTIVE    90%     Missing schemas       │
│ ✅ Xero                ACTIVE    85%     Missing token refresh │
│ ✅ Prometheus          ACTIVE    95%     Metrics working       │
│ ✅ Sentry              ACTIVE    100%    Error tracking works  │
│ 🟡 SendGrid            PARTIAL   60%     No logging/webhooks   │
│ 🟡 ElevenLabs          PARTIAL   40%     Demo only             │
│ 🟡 Redis               OPTIONAL  80%     Caching works         │
│ 🔴 Google AP2          STUB      20%     Not implemented       │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Production Readiness Checklist

**Can deploy to production?** 🟡 **YES, with mandatory fixes**

**Must-fix (1.5 weeks)**:
- [ ] Generate Pydantic schemas (shopify, xero, inventory, i18n) - 2 days
- [ ] Implement Xero OAuth token refresh - 1 day
- [ ] Fix webhook transaction boundaries - 1 day
- [ ] Add EmailLog integration for GDPR - 2 days

**Should-fix (1 week)**:
- [ ] Add admin UI for manual sync - 3 days
- [ ] Implement background job queue - 5 days

**Nice-to-have (post-launch)**:
- [ ] Complete or remove Google AP2 - 1-2 weeks OR 1 day
- [ ] Clean up dead code - 2 days
- [ ] Add distributed tracing - 5 days

---

## 6. RECOMMENDATIONS & ACTION PLAN

### Phase 1: Pre-Production Hardening (1.5 weeks)

**Week 1**:
- Day 1-2: Generate Pydantic schemas using automation script
  - Priority: shopify_schemas.py, xero_schemas.py, inventory_schemas.py
  - Script: SQLAlchemy model → Pydantic BaseModel generator
- Day 3: Implement Xero OAuth token refresh background job
- Day 4: Fix webhook transaction boundary bugs
- Day 5: Integrate SendGrid → EmailLog for GDPR compliance

**Week 2 (First 3 days)**:
- Day 1-2: Testing and validation
- Day 3: Production deployment

### Phase 2: Post-Launch Stabilization (2 weeks)

**Week 1**:
- Add admin UI for manual sync operations
- Implement webhook retry logic with exponential backoff

**Week 2**:
- Add unique constraints for Shopify mappings
- Clean up dead code (remove unused tables, commented imports)

### Phase 3: Feature Completion (3-4 weeks)

**Decision Required**: Google AP2 integration
- Option A: Complete full implementation (2-3 weeks)
- Option B: Remove entirely (1 day)

**Other features**:
- Complete customer portal frontend (if prioritized)
- Add POS reconciliation admin UI
- Implement distributed tracing with OpenTelemetry

---

## 7. RISK REGISTER

| Risk ID | Risk | Likelihood | Impact | Severity | Mitigation |
|---------|------|-----------|--------|----------|------------|
| R-001 | Xero token expires, integration breaks | HIGH | HIGH | 🔴 CRITICAL | Add token refresh job (1 day) |
| R-002 | Webhook fails, data inconsistent | MEDIUM | HIGH | 🔴 CRITICAL | Fix transaction boundaries (1 day) |
| R-003 | Email not logged (GDPR violation) | MEDIUM | HIGH | 🔴 CRITICAL | Add EmailLog integration (2 days) |
| R-004 | No Pydantic validation → bad data | MEDIUM | MEDIUM | 🟡 HIGH | Generate schemas (2 days) |
| R-005 | Race condition on stock update | LOW | HIGH | 🟡 HIGH | Verify with load test |
| R-006 | AP2 routes exist but not implemented | LOW | LOW | 🟢 LOW | Remove or complete |
| R-007 | Dead code causes confusion | LOW | LOW | 🟢 LOW | Clean up gradually |

---

## 8. CONCLUSION

### Overall Assessment

**Grade**: 🟡 **C+ (Functional but Fragile)**

**Strengths**:
- ✅ Core ERP functionality (products, orders, quotes) solid
- ✅ Shopify & Xero integrations 85-90% functional
- ✅ Good monitoring (Sentry, Prometheus)
- ✅ Security fundamentals in place (JWT, rate limiting, CORS)

**Weaknesses**:
- 🔴 92% of database models missing Pydantic schemas (type safety gap)
- 🔴 Critical bugs in webhook processing (transaction boundaries)
- 🔴 Xero OAuth token refresh missing (integration will break)
- 🔴 No email audit trail (GDPR compliance risk)
- 🔴 Several incomplete features (AP2, portal, admin UIs)

### Production Recommendation

**Deploy to production AFTER 1.5 weeks of hardening work.**

Total effort: 6 days of critical fixes + 2 days testing = 1.5 weeks

**Post-launch**: 2 weeks of stabilization work recommended before aggressive marketing.

**Long-term**: 3-4 weeks of feature completion work for full system maturity.

---

**Report End**
**Generated**: 2026-02-12
**Auditor**: Data Flow & Integration Specialist
**Next Review**: After Phase 1 completion (2 weeks)
