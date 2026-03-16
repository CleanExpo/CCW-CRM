# Routes Catalog — CCW ERP/CRM

# Last Updated: 2026-03-03

# Total Routes: 72

# Source: apps/backend/src/api/routes/

---

## Route Entries

### Domain: Infrastructure

### ROUTE-001: Health Check

- **File**: `apps/backend/src/api/routes/health.py`
- **Prefix**: /api
- **Endpoints**: GET /health
- **Domain**: Infrastructure
- **Auth**: Public
- **Status**: Active
- **Registered**: Yes (app.include_router)
- **Last Verified**: 2026-03-03

### ROUTE-002: Configuration

- **File**: `apps/backend/src/api/routes/config.py`
- **Prefix**: /api
- **Endpoints**: GET /config, PUT /config
- **Domain**: Infrastructure
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-003: Prometheus Metrics

- **File**: `apps/backend/src/api/routes/prometheus_metrics.py`
- **Prefix**: /api
- **Endpoints**: GET /metrics (Prometheus format)
- **Domain**: Infrastructure
- **Auth**: Public / Internal
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-004: Background Jobs

- **File**: `apps/backend/src/api/routes/jobs.py`
- **Prefix**: /api
- **Endpoints**: GET /jobs, GET /jobs/{job_id}, DELETE /jobs/{job_id}
- **Domain**: Infrastructure
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-005: Team Management

- **File**: `apps/backend/src/api/routes/team.py`
- **Prefix**: /api
- **Endpoints**: GET /team, POST /team, GET /team/{user_id}, PUT /team/{user_id}, DELETE /team/{user_id}
- **Domain**: Infrastructure / Multi-tenant
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-006: Cron Jobs

- **File**: `apps/backend/src/api/routes/cron_jobs.py`
- **Prefix**: /api
- **Endpoints**: GET /cron-jobs, POST /cron-jobs/{job_name}/trigger
- **Domain**: Infrastructure
- **Auth**: JWT Required
- **Status**: Active (file exists, not explicitly registered in main.py — may be imported via ai_router or monitoring)
- **Notes**: File listed but not seen in main.py import list — likely dormant or via sub-router
- **Last Verified**: 2026-03-03

### ROUTE-007: Public Stats

- **File**: `apps/backend/src/api/routes/public_stats.py`
- **Prefix**: /api
- **Endpoints**: GET /public/stats
- **Domain**: Infrastructure / Landing Page
- **Auth**: Public (no auth required)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-008: Autonomy Metrics

- **File**: `apps/backend/src/api/routes/autonomy_metrics.py`
- **Prefix**: /api
- **Endpoints**: GET /autonomy/metrics, GET /autonomy/metrics/summary
- **Domain**: Infrastructure / AI Governance
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: Auth

### ROUTE-009: Demo Auth

- **File**: `apps/backend/src/api/routes/demo_auth.py`
- **Prefix**: /api
- **Endpoints**: POST /auth/login, POST /auth/logout, GET /auth/me, POST /auth/refresh
- **Domain**: Auth
- **Auth**: Public (login), JWT Required (me/logout)
- **Status**: Active — DO NOT MODIFY (locked)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-010: Portal Auth

- **File**: `apps/backend/src/api/routes/portal_auth.py`
- **Prefix**: /api
- **Endpoints**: POST /portal/auth/login, POST /portal/auth/register, POST /portal/auth/logout, GET /portal/auth/me
- **Domain**: Auth / Customer Portal
- **Auth**: Public (login/register), JWT Required (me/logout)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-011: Portal Forms

- **File**: `apps/backend/src/api/routes/portal_forms.py`
- **Prefix**: /api
- **Endpoints**: POST /portal/contact, POST /portal/demo-request, GET /portal/submissions
- **Domain**: Auth / Customer Portal
- **Auth**: Public (contact/demo), JWT Required (submissions)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-012: Approvals

- **File**: `apps/backend/src/api/routes/approvals.py`
- **Prefix**: /api
- **Endpoints**: GET /approvals, POST /approvals, GET /approvals/{id}, PUT /approvals/{id}/approve, PUT /approvals/{id}/reject
- **Domain**: Auth / Workflow
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: Inventory

### ROUTE-013: Products

- **File**: `apps/backend/src/api/routes/products.py`
- **Prefix**: /api
- **Endpoints**: GET /products, POST /products, GET /products/{id}, PUT /products/{id}, DELETE /products/{id}
- **Domain**: Inventory
- **Auth**: JWT Required
- **Status**: Active (overrides demo_lists read-only routes)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-014: Demo Lists (Products/Customers/Orders/Quotes — Read Only)

- **File**: `apps/backend/src/api/routes/demo_lists.py`
- **Prefix**: /api
- **Endpoints**: GET /demo/products, GET /demo/customers, GET /demo/orders, GET /demo/quotes
- **Domain**: Inventory / CRM / Orders (Read Only Demo)
- **Auth**: JWT Required
- **Status**: Active (read-only, overridden by CRUD routers)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-015: Inventory (Multi-Store)

- **File**: `apps/backend/src/api/routes/inventory.py`
- **Prefix**: /api
- **Endpoints**: GET /inventory, GET /inventory/{location_code}, PUT /inventory/{product_id}, GET /inventory/summary
- **Domain**: Inventory
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-016: Backorders

- **File**: `apps/backend/src/api/routes/backorders.py`
- **Prefix**: /api
- **Endpoints**: GET /backorders, POST /backorders, GET /backorders/{id}, PUT /backorders/{id}, DELETE /backorders/{id}
- **Domain**: Inventory
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-017: Containers

- **File**: `apps/backend/src/api/routes/containers.py`
- **Prefix**: /api
- **Endpoints**: GET /containers, POST /containers, GET /containers/{id}, PUT /containers/{id}, DELETE /containers/{id}
- **Domain**: Inventory / Logistics
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-018: Shipments

- **File**: `apps/backend/src/api/routes/shipments.py`
- **Prefix**: /api
- **Endpoints**: GET /shipments, POST /shipments, GET /shipments/{id}, PUT /shipments/{id}
- **Domain**: Inventory / Logistics
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-019: Purchase Orders

- **File**: `apps/backend/src/api/routes/purchase_orders.py`
- **Prefix**: /api
- **Endpoints**: GET /purchase-orders, POST /purchase-orders, GET /purchase-orders/{id}, PUT /purchase-orders/{id}, DELETE /purchase-orders/{id}
- **Domain**: Inventory / Procurement
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-020: Inventory Stream (SSE)

- **File**: `apps/backend/src/api/routes/inventory_stream.py`
- **Prefix**: /api
- **Endpoints**: GET /inventory/stream (Server-Sent Events)
- **Domain**: Inventory / Real-Time
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-021: Suppliers

- **File**: `apps/backend/src/api/routes/suppliers.py`
- **Prefix**: /api
- **Endpoints**: GET /suppliers, POST /suppliers, GET /suppliers/{id}, PUT /suppliers/{id}, DELETE /suppliers/{id}
- **Domain**: Inventory / Procurement
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: CRM

### ROUTE-022: Customers

- **File**: `apps/backend/src/api/routes/customers.py`
- **Prefix**: /api
- **Endpoints**: GET /customers, POST /customers, GET /customers/{id}, PUT /customers/{id}, DELETE /customers/{id}
- **Domain**: CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-023: Contacts

- **File**: `apps/backend/src/api/routes/contacts.py`
- **Prefix**: /api
- **Endpoints**: GET /contacts, POST /contacts, GET /contacts/{id}, PUT /contacts/{id}, DELETE /contacts/{id}
- **Domain**: CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-024: Activities

- **File**: `apps/backend/src/api/routes/activities.py`
- **Prefix**: /api
- **Endpoints**: GET /activities, POST /activities, GET /activities/{id}, PUT /activities/{id}, DELETE /activities/{id}
- **Domain**: CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-025: Service Requests

- **File**: `apps/backend/src/api/routes/service_requests.py`
- **Prefix**: /api
- **Endpoints**: GET /service-requests, POST /service-requests, GET /service-requests/{id}, PUT /service-requests/{id}, DELETE /service-requests/{id}
- **Domain**: CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-026: Contractors

- **File**: `apps/backend/src/api/routes/contractors.py`
- **Prefix**: /api
- **Endpoints**: GET /contractors, POST /contractors, GET /contractors/{id}, PUT /contractors/{id}, DELETE /contractors/{id}
- **Domain**: CRM
- **Auth**: JWT Required
- **Status**: Active (file exists; not explicitly in main.py imports — may be inactive)
- **Notes**: Not in main.py — may be stub or future route
- **Last Verified**: 2026-03-03

---

### Domain: Orders

### ROUTE-027: Orders

- **File**: `apps/backend/src/api/routes/orders.py`
- **Prefix**: /api
- **Endpoints**: GET /orders, POST /orders, GET /orders/{id}, PUT /orders/{id}, DELETE /orders/{id}, POST /orders/{id}/items
- **Domain**: Orders
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-028: Customer Orders

- **File**: `apps/backend/src/api/routes/customer_orders.py`
- **Prefix**: /api
- **Endpoints**: GET /customers/{customer_id}/orders
- **Domain**: Orders / CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-029: Quotes

- **File**: `apps/backend/src/api/routes/quotes.py`
- **Prefix**: /api
- **Endpoints**: GET /quotes, POST /quotes, GET /quotes/{id}, PUT /quotes/{id}, DELETE /quotes/{id}, POST /quotes/{id}/items
- **Domain**: Orders
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: Financial

### ROUTE-030: Invoices

- **File**: `apps/backend/src/api/routes/invoices.py`
- **Prefix**: /api
- **Endpoints**: GET /invoices, POST /invoices, GET /invoices/{id}, PUT /invoices/{id}, DELETE /invoices/{id}
- **Domain**: Financial
- **Auth**: JWT Required
- **Status**: Active (UNI-173)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-031: Invoice Payments

- **File**: `apps/backend/src/api/routes/invoice_payments.py`
- **Prefix**: /api
- **Endpoints**: GET /invoice-payments, POST /invoice-payments, GET /invoice-payments/{id}, DELETE /invoice-payments/{id}
- **Domain**: Financial
- **Auth**: JWT Required
- **Status**: Active (UNI-173)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-032: POS Transactions

- **File**: `apps/backend/src/api/routes/pos_transactions.py`
- **Prefix**: /api
- **Endpoints**: GET /pos/transactions, POST /pos/transactions, GET /pos/transactions/{id}, PUT /pos/transactions/{id}
- **Domain**: Financial / POS
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-033: Bank Feeds

- **File**: `apps/backend/src/api/routes/bank_feeds.py`
- **Prefix**: /api
- **Endpoints**: GET /bank-feeds, POST /bank-feeds, GET /bank-feeds/{id}, POST /bank-feeds/import
- **Domain**: Financial
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-034: Reconciliation Dashboard

- **File**: `apps/backend/src/api/routes/reconciliation_dashboard.py`
- **Prefix**: /api
- **Endpoints**: GET /reconciliation/dashboard, GET /reconciliation/summary
- **Domain**: Financial
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-035: POS Xero Reconciliation

- **File**: `apps/backend/src/api/routes/pos_xero_reconciliation.py`
- **Prefix**: /api
- **Endpoints**: GET /pos/reconciliation, POST /pos/reconciliation/run, GET /pos/reconciliation/{id}
- **Domain**: Financial / POS
- **Auth**: JWT Required
- **Status**: Active (file exists; not in main.py explicit list — may be in pos_transactions or reconciliation_dashboard router)
- **Notes**: Functionality may be merged into reconciliation_dashboard
- **Last Verified**: 2026-03-03

### ROUTE-036: Billing

- **File**: `apps/backend/src/api/routes/billing.py`
- **Prefix**: /api
- **Endpoints**: GET /billing, POST /billing/subscribe, POST /billing/cancel
- **Domain**: Financial / Subscription
- **Auth**: JWT Required
- **Status**: DISABLED (commented out in main.py — requires stripe package)
- **Registered**: No (disabled)
- **Last Verified**: 2026-03-03

---

### Domain: Analytics / Dashboard

### ROUTE-037: Demo Dashboard

- **File**: `apps/backend/src/api/routes/demo_dashboard.py`
- **Prefix**: /api
- **Endpoints**: GET /dashboard/metrics, GET /dashboard/stats, GET /dashboard/recent-orders
- **Domain**: Analytics
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-038: Dashboard Stream (SSE)

- **File**: `apps/backend/src/api/routes/dashboard_stream.py`
- **Prefix**: /api
- **Endpoints**: GET /dashboard/stream (Server-Sent Events)
- **Domain**: Analytics / Real-Time
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-039: Email Audit

- **File**: `apps/backend/src/api/routes/email_audit.py`
- **Prefix**: /api
- **Endpoints**: GET /email-audit, GET /email-audit/{id}
- **Domain**: Analytics / GDPR Compliance (ISS-037)
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: Content / Translations

### ROUTE-040: Translations

- **File**: `apps/backend/src/api/routes/translations.py`
- **Prefix**: /api
- **Endpoints**: GET /translations, GET /translations/{product_id}, POST /translations/{product_id}, PUT /translations/{product_id}/{language}, DELETE /translations/{product_id}/{language}
- **Domain**: Content / i18n (10 languages)
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-041: PRD Generation

- **File**: `apps/backend/src/api/routes/prd.py`
- **Prefix**: /api
- **Endpoints**: POST /prd/generate, GET /prd/{id}, GET /prd
- **Domain**: Content / AI Generation
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-042: Webhooks

- **File**: `apps/backend/src/api/routes/webhooks.py`
- **Prefix**: /api
- **Endpoints**: POST /webhooks/{source}, GET /webhooks/events, GET /webhooks/events/{id}, POST /webhooks/retry/{id}
- **Domain**: Content / Integration
- **Auth**: Signature verification (source-specific)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-043: Submissions

- **File**: `apps/backend/src/api/routes/portal_forms.py` (shared)
- **Prefix**: /api
- **Endpoints**: GET /submissions, GET /submissions/{id}
- **Domain**: Content / CRM
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes (via portal_forms router)
- **Last Verified**: 2026-03-03

---

### Domain: AI Routes (conditional — requires langchain/langgraph)

### ROUTE-044: AI Chat

- **File**: `apps/backend/src/api/routes/ai/chat.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/chat, GET /ai/chat/{conversation_id}
- **Domain**: AI
- **Auth**: JWT Required
- **Status**: Active (conditional on AI deps)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-045: AI Insights

- **File**: `apps/backend/src/api/routes/ai/insights.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/insights, POST /ai/insights/generate
- **Domain**: AI / Analytics
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-046: AI Generate

- **File**: `apps/backend/src/api/routes/ai/generate.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/generate/quote, POST /ai/generate/email, POST /ai/generate/summary
- **Domain**: AI / Generation
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-047: AI Search

- **File**: `apps/backend/src/api/routes/search.py`
- **Prefix**: /api
- **Endpoints**: GET /search, POST /search/semantic, POST /search/hybrid
- **Domain**: AI / Search
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-048: AI Recommendations

- **File**: `apps/backend/src/api/routes/recommendations.py`
- **Prefix**: /api
- **Endpoints**: GET /recommendations/{product_id}, GET /recommendations/customer/{customer_id}
- **Domain**: AI / Content
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-049: Autonomous Development

- **File**: `apps/backend/src/api/routes/autonomous_dev.py`
- **Prefix**: /api
- **Endpoints**: POST /autonomous/task, GET /autonomous/status/{task_id}, GET /autonomous/history
- **Domain**: AI / Development
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-050: AI Anomaly Detection

- **File**: `apps/backend/src/api/routes/ai/anomaly.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/anomaly/detect, POST /ai/anomaly/analyze
- **Domain**: AI / Monitoring
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-051: AI Inventory Forecast

- **File**: `apps/backend/src/api/routes/ai/inventory_forecast.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/inventory/forecast, POST /ai/inventory/forecast/{product_id}
- **Domain**: AI / Inventory
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-052: AI Assets

- **File**: `apps/backend/src/api/routes/ai/assets.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/assets, POST /ai/assets/generate
- **Domain**: AI / Content
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-053: AI Document Parser

- **File**: `apps/backend/src/api/routes/ai/document_parser.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/documents/parse
- **Domain**: AI / Documents
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-054: AI Form Autofill

- **File**: `apps/backend/src/api/routes/ai/form_autofill.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/forms/autofill
- **Domain**: AI / Forms
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-055: AI Protocol

- **File**: `apps/backend/src/api/routes/ai/protocol.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/protocol/status, GET /ai/protocol/agents
- **Domain**: AI / Governance
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-03

### ROUTE-056: AI Supervisor

- **File**: `apps/backend/src/api/routes/ai/supervisor.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/supervisor/route, GET /ai/supervisor/status
- **Domain**: AI / Orchestration
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-03

### ROUTE-057: AI Learning

- **File**: `apps/backend/src/api/routes/ai/learning.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/learning/patterns, POST /ai/learning/record
- **Domain**: AI / Learning
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-058: AI Monitoring

- **File**: `apps/backend/src/api/routes/ai/monitoring.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/monitoring/health, GET /ai/monitoring/metrics
- **Domain**: AI / Monitoring
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-03

### ROUTE-059: AI Specialized

- **File**: `apps/backend/src/api/routes/ai/specialized.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/specialized/pricing, POST /ai/specialized/procurement
- **Domain**: AI / Specialized Agents
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-03

### ROUTE-060: AI Test Data

- **File**: `apps/backend/src/api/routes/ai/test_data.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/test-data/generate, GET /ai/test-data/status
- **Domain**: AI / Testing
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-061: Cin7 AI Forecasting

- **File**: `apps/backend/src/api/routes/ai/cin7_forecast.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/cin7/forecast, POST /ai/cin7/forecast/{product_id}
- **Domain**: AI / Cin7
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-062: Cin7 AI Anomaly Detection

- **File**: `apps/backend/src/api/routes/ai/cin7_anomaly.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /ai/cin7/anomaly, POST /ai/cin7/anomaly/analyze
- **Domain**: AI / Cin7
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-063: Test Data Generation

- **File**: `apps/backend/src/api/routes/test_data_gen.py`
- **Prefix**: /api
- **Endpoints**: POST /test-data/generate, DELETE /test-data/cleanup
- **Domain**: AI / Testing
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

---

### Domain: Integrations

### ROUTE-064: Cin7 Integration

- **File**: `apps/backend/src/api/routes/integrations/cin7.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /integrations/cin7/status, POST /integrations/cin7/connect, DELETE /integrations/cin7/disconnect, GET /integrations/cin7/connections
- **Domain**: Integration / Cin7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-065: Cin7 Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_sync.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/cin7/sync/products, POST /integrations/cin7/sync/inventory, GET /integrations/cin7/sync/status
- **Domain**: Integration / Cin7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-066: Cin7 CRM Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_crm.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/cin7/sync/customers, POST /integrations/cin7/sync/orders, POST /integrations/cin7/sync/quotes
- **Domain**: Integration / Cin7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-067: Cin7 Procurement Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_procurement.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/cin7/sync/suppliers, POST /integrations/cin7/sync/purchase-orders
- **Domain**: Integration / Cin7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-068: Cin7 Webhooks

- **File**: `apps/backend/src/api/routes/integrations/cin7_webhooks.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/cin7/webhook, GET /integrations/cin7/webhooks
- **Domain**: Integration / Cin7
- **Auth**: Signature verification
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-069: Cin7 Stream (SSE)

- **File**: `apps/backend/src/api/routes/integrations/cin7_stream.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /integrations/cin7/stream (Server-Sent Events), GET /integrations/cin7/events
- **Domain**: Integration / Cin7 / Real-Time
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-070: Xero Integration

- **File**: `apps/backend/src/api/routes/integrations/xero.py`
- **Prefix**: /api (explicit prefix in main.py)
- **Endpoints**: GET /xero/status, POST /xero/connect, GET /xero/contacts, POST /xero/sync/invoices, POST /xero/webhook
- **Domain**: Integration / Xero
- **Auth**: JWT Required + OAuth
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-071: Shopify Integration

- **File**: `apps/backend/src/api/routes/integrations/shopify.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /integrations/shopify/status, POST /integrations/shopify/connect, POST /integrations/shopify/sync/products, POST /integrations/shopify/webhook
- **Domain**: Integration / Shopify
- **Auth**: JWT Required + Shopify HMAC
- **Status**: Active (blocked by Shopify auth prerequisite for full functionality)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-072: Shopify Theme APIs

- **File**: `apps/backend/src/api/routes/integrations/shopify_theme.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /integrations/shopify/theme, PUT /integrations/shopify/theme/settings
- **Domain**: Integration / Shopify
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-073: SendGrid Integration

- **File**: `apps/backend/src/api/routes/integrations/sendgrid.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/sendgrid/send, GET /integrations/sendgrid/status, POST /integrations/sendgrid/webhook
- **Domain**: Integration / Email
- **Auth**: JWT Required + SendGrid signature
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-074: ElevenLabs Integration

- **File**: `apps/backend/src/api/routes/integrations/elevenlabs.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/elevenlabs/synthesize, GET /integrations/elevenlabs/voices
- **Domain**: Integration / Voice / AI
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-075: AP2 (Google Pay) Integration

- **File**: `apps/backend/src/api/routes/integrations/ap2.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /integrations/ap2/payment, GET /integrations/ap2/status, POST /integrations/ap2/webhook
- **Domain**: Integration / Payments
- **Auth**: JWT Required + AP2 signature
- **Status**: Active (backend complete; frontend UI pending — Google AP2)
- **Registered**: Yes
- **Last Verified**: 2026-03-03

### ROUTE-076: Google AI

- **File**: `apps/backend/src/api/routes/google_ai.py`
- **Prefix**: /api
- **Endpoints**: POST /google-ai/generate, POST /google-ai/image, GET /google-ai/models
- **Domain**: Integration / Google AI (Imagen 4, Gemini)
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-03

---

### Domain: Monitoring

### ROUTE-078: Monitoring Alerts

- **File**: `apps/backend/src/api/routes/monitoring/alerts.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET /monitoring/alerts, POST /monitoring/alerts, PUT /monitoring/alerts/{id}/acknowledge
- **Domain**: Monitoring
- **Auth**: JWT Required
- **Status**: Active (conditional — try/except in main.py)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-079: Business Metrics

- **File**: `apps/backend/src/api/routes/monitoring/business_metrics.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET /monitoring/business-metrics, GET /monitoring/kpi
- **Domain**: Monitoring / Analytics
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

### ROUTE-080: Performance Monitoring

- **File**: `apps/backend/src/api/routes/monitoring/performance.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET /monitoring/performance, GET /monitoring/performance/summary
- **Domain**: Monitoring / Infrastructure
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-03

---

### Additional Routes (file exists, registration inferred)

### ROUTE-081: Test Failures (AI)

- **File**: `apps/backend/src/api/routes/ai/test_failures.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /ai/test/inject-failures, GET /ai/test/failure-patterns
- **Domain**: AI / Testing
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Last Verified**: 2026-03-03

### ROUTE-082: Toolshed (Minions Context API)

- **File**: `apps/backend/src/api/routes/ai/toolshed.py`
- **Prefix**: /api/ai/toolshed
- **Endpoints**: POST /bundle, GET /search, GET /pattern, POST /verify
- **Domain**: AI / Context Engineering
- **Auth**: JWT Required
- **Status**: Active (conditional — try/except registered)
- **Last Verified**: 2026-03-03
