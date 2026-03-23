# Routes Catalog — CCW ERP/CRM

# Last Updated: 2026-03-17

# Total Route Files: 106

# Total Endpoints: ~640 (across all route files)

# Source: apps/backend/src/api/routes/

# Obsidian Vault: Synced 2026-03-24 | 121 route docs | Run `python scripts/audit-vault.py` to verify

---

## Route Entries

### Domain: Infrastructure

### ROUTE-001: Health Check

- **File**: `apps/backend/src/api/routes/health.py`
- **Prefix**: /api
- **Endpoints**: GET /health, GET /health/database, GET /health/routes, GET /ready
- **Count**: 4
- **Auth**: Public
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-002: Configuration

- **File**: `apps/backend/src/api/routes/config.py`
- **Prefix**: /api
- **Endpoints**: GET /business, GET /settings, GET /frontend-config, GET /tax-rate, GET /ai-providers, GET /locations
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-003: Prometheus Metrics

- **File**: `apps/backend/src/api/routes/prometheus_metrics.py`
- **Prefix**: /api
- **Endpoints**: GET /metrics
- **Count**: 1
- **Auth**: Public / Internal
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-004: Background Jobs

- **File**: `apps/backend/src/api/routes/jobs.py`
- **Prefix**: /api
- **Endpoints**: POST /, GET /{job_id}, GET /, DELETE /{job_id}
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-005: Team Management

- **File**: `apps/backend/src/api/routes/team.py`
- **Prefix**: /api
- **Endpoints**: GET "", POST /invite, PUT /{user_id}/role, DELETE /{user_id}
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-006: Cron Jobs

- **File**: `apps/backend/src/api/routes/cron_jobs.py`
- **Prefix**: /api
- **Endpoints**: POST /check-expiring-quotes, POST /refresh-xero-tokens, GET /xero-token-health, POST /retry-failed-webhooks, GET /webhook-health, GET /dead-letter-queue, POST /refresh-health-scores, POST /process-onboarding-emails, POST /check-sla-breaches, POST /dead-letter-queue/{webhook_id}/retry
- **Count**: 10
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-007: Public Stats

- **File**: `apps/backend/src/api/routes/public_stats.py`
- **Prefix**: /api
- **Endpoints**: GET /stats
- **Count**: 1
- **Auth**: Public
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-008: Autonomy Metrics

- **File**: `apps/backend/src/api/routes/autonomy_metrics.py`
- **Prefix**: /api
- **Endpoints**: GET /metrics, GET /metrics/prometheus, GET /audit/recent, GET /anomalies, GET /health
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-009: Analytics

- **File**: `apps/backend/src/api/routes/analytics.py`
- **Prefix**: /api
- **Endpoints**: GET /metrics/overview
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-010: Settings

- **File**: `apps/backend/src/api/routes/settings.py`
- **Prefix**: /api
- **Endpoints**: GET /company, PUT /company
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-011: Agent Monitoring

- **File**: `apps/backend/src/api/routes/agents_monitor.py`
- **Prefix**: /api
- **Endpoints**: GET /stats, GET /list, GET /tasks/recent, GET /performance/trends, GET /insights
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-012: Warehouse

- **File**: `apps/backend/src/api/routes/warehouse.py`
- **Prefix**: /api
- **Endpoints**: GET /ops
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Auth

### ROUTE-013: Demo Auth

- **File**: `apps/backend/src/api/routes/demo_auth.py`
- **Prefix**: /api
- **Endpoints**: POST /login, GET /me, POST /refresh, POST /logout, POST /forgot-password, POST /reset-password, POST /register, PATCH /me, POST /change-password
- **Count**: 9
- **Auth**: Public (login/register), JWT Required (me/logout)
- **Status**: Active — DO NOT MODIFY (locked)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-014: Auth Signup

- **File**: `apps/backend/src/api/routes/auth_signup.py`
- **Prefix**: /api
- **Endpoints**: POST /signup
- **Count**: 1
- **Auth**: Public
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-015: Portal Auth

- **File**: `apps/backend/src/api/routes/portal_auth.py`
- **Prefix**: /api
- **Endpoints**: POST /send-magic-link, GET /verify, POST /logout, GET /me
- **Count**: 4
- **Auth**: Public (magic-link), JWT Required (me/logout)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-016: Portal Forms

- **File**: `apps/backend/src/api/routes/portal_forms.py`
- **Prefix**: /api
- **Endpoints**: POST /contact-submissions, GET /contact-submissions, POST /demo-requests, GET /demo-requests, GET /contact-submissions/{id}, PATCH /contact-submissions/{id}/status, GET /demo-requests/{id}, PATCH /demo-requests/{id}/status, GET /submissions/statistics, POST /submissions/{type}/{id}/notes, GET /submissions/{type}/{id}/notes
- **Count**: 11
- **Auth**: Public (submissions), JWT Required (admin views)
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-017: Approvals

- **File**: `apps/backend/src/api/routes/approvals.py`
- **Prefix**: /api
- **Endpoints**: POST "", GET "", GET /pending, GET /{id}, POST /{id}/steps, PUT /{id}/steps/{step_id}, DELETE /{id}
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Inventory

### ROUTE-018: Products

- **File**: `apps/backend/src/api/routes/products.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-019: Demo Lists (Read Only)

- **File**: `apps/backend/src/api/routes/demo_lists.py`
- **Prefix**: /api
- **Endpoints**: GET /products, GET /customers, GET /orders, GET /quotes
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (read-only, overridden by CRUD routers)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-020: Inventory (Multi-Store)

- **File**: `apps/backend/src/api/routes/inventory.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /summary, PATCH /reorder-settings/{product_id}/{location}, GET /barcode/{code}, POST /barcode, DELETE /barcode/{code}, GET /product/{product_id}/locations, GET /by-location, GET /low-stock, GET /stock-health, GET /transfer-suggestions, POST /transfer, GET /transfers, POST /reserve, POST /release/{reservation_id}, POST /adjust, POST /stock-take, GET /stock-takes, POST /stock-take/{take_id}/submit, GET /reorder-rules, POST /reorder-rules, GET /reorder-alerts, POST /auto-reorder, GET /products/{id}/attributes, POST /products/{id}/attributes, DELETE /products/{id}/attributes/{attr_id}, GET /products/{id}/variants, POST /products/{id}/variants, DELETE /products/{id}/variants/{var_id}
- **Count**: 30
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-021: Backorders

- **File**: `apps/backend/src/api/routes/backorders.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /pending, GET /{id}, POST /, PUT /{id}, POST /{id}/allocate, POST /{id}/fulfill, POST /{id}/notify, DELETE /{id}
- **Count**: 10 (includes 1 hidden duplicate)
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-022: Containers

- **File**: `apps/backend/src/api/routes/containers.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /arriving-soon, GET /{id}, POST /, PUT /{id}, POST /{id}/receive, DELETE /{id}
- **Count**: 8 (includes 1 hidden duplicate)
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-023: Shipments

- **File**: `apps/backend/src/api/routes/shipments.py`
- **Prefix**: /api
- **Endpoints**: GET /inbound, GET /inbound/{id}, POST /inbound, PUT /inbound/{id}, GET /outbound, GET /outbound/{id}, POST /outbound, PUT /outbound/{id}, GET /track/{tracking_number}, POST /webhooks/inbound/{id}, POST /webhooks/outbound/{id}
- **Count**: 11
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-024: Purchase Orders

- **File**: `apps/backend/src/api/routes/purchase_orders.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, POST /{id}/items/{item_id}/receive, DELETE /{id}
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-025: Inventory Stream (SSE)

- **File**: `apps/backend/src/api/routes/inventory_stream.py`
- **Prefix**: /api
- **Endpoints**: GET /inventory-stream, GET /inventory-stream/stats, POST /orders
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-026: Suppliers

- **File**: `apps/backend/src/api/routes/suppliers.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: CRM

### ROUTE-027: Customers

- **File**: `apps/backend/src/api/routes/customers.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-028: Contacts

- **File**: `apps/backend/src/api/routes/contacts.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}, GET /customer/{customer_id}, POST /{id}/set-primary
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-029: Activities

- **File**: `apps/backend/src/api/routes/activities.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /stats, GET /{id}, POST "", PUT /{id}, DELETE /{id}, POST /{id}/complete, GET /customer/{customer_id}, GET /contact/{contact_id}, GET /pending-tasks
- **Count**: 10
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-030: Service Requests

- **File**: `apps/backend/src/api/routes/service_requests.py`
- **Prefix**: /api
- **Endpoints**: POST "", GET "", GET /{id}, PATCH /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-031: Contractors

- **File**: `apps/backend/src/api/routes/contractors.py`
- **Prefix**: /api
- **Endpoints**: GET (list), GET (available), POST, PATCH, DELETE, POST (availability), GET (availability), GET (calendar)
- **Count**: 8
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-032: CRM Health

- **File**: `apps/backend/src/api/routes/crm_health.py`
- **Prefix**: /api
- **Endpoints**: GET /health-scores, GET /health-scores/{customer_id}
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active (UNI-1114)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-033: CRM Onboarding

- **File**: `apps/backend/src/api/routes/crm_onboarding.py`
- **Prefix**: /api
- **Endpoints**: GET /sequences, POST /sequences/trigger, PATCH /sequences/{id}/cancel
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (UNI-1113)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-034: CRM Personas

- **File**: `apps/backend/src/api/routes/crm_personas.py`
- **Prefix**: /api
- **Endpoints**: GET "", POST /classify-all, GET /{customer_id}
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (UNI-1112)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Orders

### ROUTE-035: Orders

- **File**: `apps/backend/src/api/routes/orders.py`
- **Prefix**: /api
- **Endpoints**: GET /status-stream, GET "", GET /{id}, GET /{id}/activity, POST "", PUT /{id}, PUT /{id}/status, PATCH /{id}/status, DELETE /{id}
- **Count**: 9
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-036: Customer Orders

- **File**: `apps/backend/src/api/routes/customer_orders.py`
- **Prefix**: /api
- **Endpoints**: GET /{customer_id}/orders
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-037: Quotes

- **File**: `apps/backend/src/api/routes/quotes.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}, PATCH /{id}/status, POST /generate, POST /{id}/convert-to-order
- **Count**: 8
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Financial

### ROUTE-038: Invoices

- **File**: `apps/backend/src/api/routes/invoices.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /reports/revenue, GET /reports/tax, GET /tax-rates, POST /from-order/{order_id}, GET /{id}, POST "", PUT /{id}, DELETE /{id}, POST /{id}/send, POST /{id}/cancel, **POST /tax/calculate** (GAP-025)
- **Count**: 12
- **Auth**: JWT Required
- **Status**: Active (UNI-173, GAP-025)
- **Registered**: Yes
- **Last Verified**: 2026-03-17
- **Notes**: `/tax/calculate` uses `tax_calculator.py` service for jurisdiction-aware tax calculation (AU GST, CA GST/PST/HST)

### ROUTE-039: Invoice Payments

- **File**: `apps/backend/src/api/routes/invoice_payments.py`
- **Prefix**: /api
- **Endpoints**: GET /{invoice_id}/payments, POST /{invoice_id}/payments, GET /payments, DELETE /payments/{payment_id}
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (UNI-173)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-039A: Billing & Payment Methods

- **File**: `apps/backend/src/api/routes/billing.py`
- **Prefix**: /api/billing
- **Endpoints**: POST /payment-methods (GAP-010), GET /payment-methods/enum (GAP-011), POST /dunning/send-letter (GAP-012), GET /subscription-health (GAP-013), POST /retry-failed-payment (GAP-014)
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active (Phase 2 Batch 2A)
- **Registered**: Yes
- **Last Verified**: 2026-03-17
- **Dependencies**: Uses `dunning.py` service (GAP-029) for automated overdue invoice reminders
- **Notes**: `/dunning/send-letter` implements 4-level escalation (Friendly/Formal/Final/Collections). Mock payment processing - integrate with Stripe/PayPal in production.

### ROUTE-040: POS Transactions

- **File**: `apps/backend/src/api/routes/pos_transactions.py`
- **Prefix**: /api
- **Endpoints**: GET /health, POST /transactions-simple, POST /transactions, GET /transactions/{id}, GET /transactions, GET /locations, GET /sales-staff, GET /terminals, POST /terminals, PUT /terminals/{id}, DELETE /terminals/{id}, POST /xero-invoice, POST /xero/bulk-invoices
- **Count**: 13
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-041: Bank Feeds

- **File**: `apps/backend/src/api/routes/bank_feeds.py`
- **Prefix**: /api
- **Endpoints**: POST /sync, POST /reconcile, GET /unreconciled, GET /accounts, POST /accounts, PUT /accounts/{id}, DELETE /accounts/{id}, GET /stats, GET /alerts, GET /daily-summary, POST /bulk-reconcile, GET /export, POST /webhook/{provider}
- **Count**: 13
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-042: Reconciliation (AI-Powered Matching)

- **File**: `apps/backend/src/api/routes/reconciliation.py`
- **Prefix**: /api
- **Endpoints**: **GET /match-suggestions** (GAP-026), **POST /auto-match** (GAP-027)
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active (GAP-026, GAP-027)
- **Registered**: Yes
- **Last Verified**: 2026-03-17
- **Notes**: AI-powered invoice-payment matching with confidence scoring. `/match-suggestions` provides match candidates, `/auto-match` auto-reconciles high-confidence pairs (≥95%)

### ROUTE-043: Reconciliation Dashboard

- **File**: `apps/backend/src/api/routes/reconciliation_dashboard.py`
- **Prefix**: /api
- **Endpoints**: GET /dashboard, GET /pending, POST /bulk-approve, POST /generate-suggestions/{account_id}
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-044: POS Xero Reconciliation

- **File**: `apps/backend/src/api/routes/pos_xero_reconciliation.py`
- **Prefix**: /api
- **Endpoints**: POST /transactions/{id}/create-xero-invoice, POST /reconcile, POST /auto-reconcile, GET /reconciliation-stats
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-045: Billing

- **File**: `apps/backend/src/api/routes/billing.py`
- **Prefix**: /api
- **Endpoints**: GET "", POST /subscribe, PUT /subscription, DELETE /subscription, GET /invoices, POST /webhooks
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Analytics / Dashboard

### ROUTE-045: Demo Dashboard

- **File**: `apps/backend/src/api/routes/demo_dashboard.py`
- **Prefix**: /api
- **Endpoints**: GET /aggregated, GET /metrics-stream, GET /metrics, GET /charts/revenue, GET /charts/categories, GET /charts/top-products, GET /charts/inventory, GET /activity, GET /order-status-breakdown, GET /quote-conversion, GET /revenue-by-location
- **Count**: 11
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-046: Dashboard Stream (SSE)

- **File**: `apps/backend/src/api/routes/dashboard_stream.py`
- **Prefix**: /api
- **Endpoints**: GET /metrics-stream, GET /metrics-stream/stats, POST /orders, PUT /orders/{id}, POST /test-event
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-047: Email Audit

- **File**: `apps/backend/src/api/routes/email_audit.py`
- **Prefix**: /api
- **Endpoints**: POST /webhooks/sendgrid/events, GET /history, GET /history/{id}, GET /gdpr/export, GET /consent/{email}, POST /consent/update, POST /consent/unsubscribe, GET /stats, GET /suppression-list, POST /check-send
- **Count**: 10
- **Auth**: JWT Required / Signature verification
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Content / Translations

### ROUTE-048: Translations

- **File**: `apps/backend/src/api/routes/translations.py`
- **Prefix**: /api
- **Endpoints**: GET /languages, GET /products, GET /coverage, POST /products/batch, PUT /products/{product_id}/{language_code}, GET /products/{product_id}/{language_code}, POST /products/{product_id}/translate/{language_code}
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-049: PRD Generation

- **File**: `apps/backend/src/api/routes/prd.py`
- **Prefix**: /api
- **Endpoints**: POST /generate, GET /{id}, GET "", DELETE /{id}, GET /{id}/agent-runs, GET /{id}/cost
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-050: Webhooks

- **File**: `apps/backend/src/api/routes/webhooks.py`
- **Prefix**: /api
- **Endpoints**: POST /contact-form, POST /demo-request, GET /test
- **Count**: 3
- **Auth**: Signature verification
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-051: Chat

- **File**: `apps/backend/src/api/routes/chat.py`
- **Prefix**: /api
- **Endpoints**: POST /chat
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes (implied)
- **Last Verified**: 2026-03-17

---

### Domain: Workflow / Notifications

### ROUTE-052: Workflows

- **File**: `apps/backend/src/api/routes/workflows.py`
- **Prefix**: /api
- **Endpoints**: GET /templates, POST /templates, GET /templates/{id}, PUT /templates/{id}, DELETE /templates/{id}, GET /instances, GET /instances/{id}
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active (UNI-174)
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-053: SLA

- **File**: `apps/backend/src/api/routes/sla.py`
- **Prefix**: /api
- **Endpoints**: GET /rules, POST /rules, PUT /rules/{id}, GET /instances, GET /instances/{entity_id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active (UNI-174)
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-054: Notifications

- **File**: `apps/backend/src/api/routes/notifications.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /unread-count, POST /{id}/read, POST /read-all
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (UNI-174)
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

---

### Domain: Workshop

### ROUTE-055: Workshop Equipment

- **File**: `apps/backend/src/api/routes/workshop/equipment.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}, POST /{id}/update-hours, POST /{id}/record-service
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-056: Workshop Templates

- **File**: `apps/backend/src/api/routes/workshop/templates.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-057: Workshop Bookings

- **File**: `apps/backend/src/api/routes/workshop/bookings.py`
- **Prefix**: /api
- **Endpoints**: GET "", GET /{id}, POST "", PUT /{id}, POST /{id}/complete, POST /{id}/order-parts
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-058: Workshop Reminders

- **File**: `apps/backend/src/api/routes/workshop/reminders.py`
- **Prefix**: /api
- **Endpoints**: GET "", POST /generate, POST /{id}/send, POST /send-pending, PUT /{id}/suppress
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-059: Workshop Dashboard

- **File**: `apps/backend/src/api/routes/workshop/dashboard.py`
- **Prefix**: /api
- **Endpoints**: GET ""
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

---

### Domain: AI Routes (conditional — requires langchain/langgraph)

### ROUTE-060: AI Chat

- **File**: `apps/backend/src/api/routes/ai/chat.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /new, POST /message, POST /stream, GET /history/{conversation_id}, DELETE /history/{conversation_id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-061: AI Insights

- **File**: `apps/backend/src/api/routes/ai/insights.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /generate, GET /dashboard, GET /history
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-062: AI Generate

- **File**: `apps/backend/src/api/routes/ai/generate.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /quote, POST /email, POST /summary, POST /image, POST /product-copy, POST /copy
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-063: AI Search

- **File**: `apps/backend/src/api/routes/search.py`
- **Prefix**: /api
- **Endpoints**: POST /, GET /semantic, GET /hybrid, GET /analytics
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-064: AI Recommendations

- **File**: `apps/backend/src/api/routes/recommendations.py`
- **Prefix**: /api
- **Endpoints**: GET /similar/{product_id}, GET /frequently-bought-together/{product_id}, GET /personalized/{customer_id}, POST /track-interaction, POST /precompute, POST /update-co-occurrences
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-065: Autonomous Development

- **File**: `apps/backend/src/api/routes/autonomous_dev.py`
- **Prefix**: /api
- **Endpoints**: POST /projects, GET /projects/{id}/progress, GET /status, GET /status/detailed, POST /start, POST /stop, POST /projects/resume, GET /projects, GET /agents/activity
- **Count**: 9
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-066: AI Anomaly Detection

- **File**: `apps/backend/src/api/routes/ai/anomaly.py`
- **Prefix**: /api/ai
- **Endpoints**: POST ""
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-067: AI Inventory Forecast

- **File**: `apps/backend/src/api/routes/ai/inventory_forecast.py`
- **Prefix**: /api/ai
- **Endpoints**: POST "", GET /low-stock
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-068: AI Assets

- **File**: `apps/backend/src/api/routes/ai/assets.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /assets, DELETE /assets/{id}, GET /stats
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-069: AI Document Parser

- **File**: `apps/backend/src/api/routes/ai/document_parser.py`
- **Prefix**: /api/ai
- **Endpoints**: POST ""
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-070: AI Form Autofill

- **File**: `apps/backend/src/api/routes/ai/form_autofill.py`
- **Prefix**: /api/ai
- **Endpoints**: POST ""
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-071: AI Protocol

- **File**: `apps/backend/src/api/routes/ai/protocol.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /version, GET /agents, GET /agents/{id}, POST /validate-delegation, GET /health, GET /audit-log
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-072: AI Supervisor

- **File**: `apps/backend/src/api/routes/ai/supervisor.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /route, POST /analyze
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-073: AI Learning

- **File**: `apps/backend/src/api/routes/ai/learning.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /extract-patterns, POST /generate-insights, GET /patterns, GET /insights, POST /variants, POST /variants/record, GET /variants/{agent_id}, POST /variants/{agent_id}/select-best, GET /status, POST /load-from-db, POST /test-data/generate
- **Count**: 11
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-074: AI Monitoring

- **File**: `apps/backend/src/api/routes/ai/monitoring.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /agents, GET /system, GET /executions, GET /health, GET /stats/{agent_id}, POST /test-data/generate
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-075: AI Specialized

- **File**: `apps/backend/src/api/routes/ai/specialized.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /pricing/recommend, POST /procurement/analyze, POST /executor/validate, POST /executor/execute
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-076: AI Test Data

- **File**: `apps/backend/src/api/routes/ai/test_data.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /generate-with-failures
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-077: AI Test Failures

- **File**: `apps/backend/src/api/routes/ai/test_failures.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /generate
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional (via ai_router)
- **Last Verified**: 2026-03-17

### ROUTE-078: Cin7 AI Forecasting

- **File**: `apps/backend/src/api/routes/ai/cin7_forecast.py`
- **Prefix**: /api/ai
- **Endpoints**: POST "", GET /velocity, GET /health
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-079: Cin7 AI Anomaly Detection

- **File**: `apps/backend/src/api/routes/ai/cin7_anomaly.py`
- **Prefix**: /api/ai
- **Endpoints**: POST "", GET /sync-health, GET /health
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-080: Cin7 Shadow AI

- **File**: `apps/backend/src/api/routes/ai/cin7_shadow_ai.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /analyze, POST /auto-resolve, GET /health
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-081: Marketing AI

- **File**: `apps/backend/src/api/routes/ai/marketing_ai.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /generate-campaign, POST /analyze-audience, GET /stats
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-082: Staff Copilot

- **File**: `apps/backend/src/api/routes/ai/staff_copilot.py`
- **Prefix**: /api/ai
- **Endpoints**: POST /query, GET /health
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-083: Project Intelligence

- **File**: `apps/backend/src/api/routes/ai/project_intelligence.py`
- **Prefix**: /api/ai
- **Endpoints**: GET /health, POST /scan-routes, POST /scan-pages, POST /scan-agents, POST /scan-packages, POST /cross-ref, POST /dep-graph, POST /prioritize, POST /prd-generate, POST /issue-sync
- **Count**: 10
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-084: Toolshed (Context API)

- **File**: `apps/backend/src/api/routes/ai/toolshed.py`
- **Prefix**: /api/ai/toolshed
- **Endpoints**: GET /items, POST /bundle, GET /search, GET /pattern, POST /verify
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-085: Test Data Generation

- **File**: `apps/backend/src/api/routes/test_data_gen.py`
- **Prefix**: /api
- **Endpoints**: POST /generate
- **Count**: 1
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

---

### Domain: Integrations

### ROUTE-086: Cin7 Integration

- **File**: `apps/backend/src/api/routes/integrations/cin7.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /test, GET /status, GET /locations, GET /products/preview, GET /customers/preview, GET /inventory/preview
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-087: Cin7 Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_sync.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /products, POST /products/{id}, POST /inventory, POST /inventory/{id}, GET /logs
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-088: Cin7 CRM Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_crm.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /customers, POST /customers/{id}, POST /orders, POST /orders/{id}, POST /quotes, POST /quotes/{id}
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-089: Cin7 Procurement Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_procurement.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /suppliers, POST /suppliers/{id}, POST /purchases, POST /purchases/{id}
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-090: Cin7 Webhooks

- **File**: `apps/backend/src/api/routes/integrations/cin7_webhooks.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /receive, GET /status, POST /test
- **Count**: 3
- **Auth**: Signature verification
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-091: Cin7 Stream (SSE)

- **File**: `apps/backend/src/api/routes/integrations/cin7_stream.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /stream, GET /stream/stats, POST /stream/test, POST /poll, GET /poll/status
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-092: Cin7 Line Items

- **File**: `apps/backend/src/api/routes/integrations/cin7_line_items.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /orders/{mapping_id}/line-items, GET /purchase-orders/{mapping_id}/line-items
- **Count**: 2
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-093: Cin7 GRN

- **File**: `apps/backend/src/api/routes/integrations/cin7_grn.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST "", GET "", GET /{id}, POST /{id}/lines, DELETE /{id}/lines/{line_id}, POST /{id}/confirm
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-094: Cin7 Inventory Write-Back

- **File**: `apps/backend/src/api/routes/integrations/cin7_inventory_writeback.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /stock-adjustments, GET /stock-adjustments, POST /stock-transfers, GET /stock-transfers, POST /stock-takes, GET /stock-takes, POST /stock-takes/{id}/lines, POST /stock-takes/{id}/submit
- **Count**: 8
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-095: Cin7 Webhook Subscriptions

- **File**: `apps/backend/src/api/routes/integrations/cin7_webhook_subscriptions.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST "", GET "", GET /{id}, PATCH /{id}, DELETE /{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-096: Cin7 BOM

- **File**: `apps/backend/src/api/routes/integrations/cin7_bom.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET "", POST /sync, GET /production-runs, POST /production-runs, PATCH /production-runs/{id}/status, GET /{bom_id}
- **Count**: 6
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-097: Cin7 Fulfilment

- **File**: `apps/backend/src/api/routes/integrations/cin7_fulfilment.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /fulfilments, POST /fulfilments, PATCH /fulfilments/{id}/status, GET /invoices, POST /invoices/sync, PATCH /invoices/{id}/mark-paid, GET /payments
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-098: Cin7 Shadow Sync

- **File**: `apps/backend/src/api/routes/integrations/cin7_shadow_sync.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /poll, GET /status, GET /gaps, GET /gaps/summary, PATCH /gaps/{id}
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-099: Cin7 GL (Financial)

- **File**: `apps/backend/src/api/routes/integrations/cin7_gl.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /chart-of-accounts, POST /chart-of-accounts/sync, GET /journal-entries, POST /journal-entries, PATCH /journal-entries/{id}, GET /account-mappings, PUT /account-mappings
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Conditional (try/except)
- **Last Verified**: 2026-03-17

### ROUTE-100: Xero Integration

- **File**: `apps/backend/src/api/routes/integrations/xero.py`
- **Prefix**: /api (explicit prefix in main.py)
- **Endpoints**: GET /authorize, GET /callback, GET /status, POST /disconnect, POST /sync-order/{id}, POST /sync-all, GET /invoice/{id}, POST /poll-payments, POST /sync-customer/{id}, POST /sync-customers, POST /webhooks
- **Count**: 11
- **Auth**: JWT Required + OAuth
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-101: Shopify Integration

- **File**: `apps/backend/src/api/routes/integrations/shopify.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /test, GET /scopes, GET /config, GET /status, POST /connect, POST /disconnect, POST /import-order/{id}, POST /import-orders, POST /sync-inventory/{id}, POST /sync-all-inventory, POST /sync-product/{id}, POST /sync-from-shopify/{id}, POST /sync-to-shopify/{id}, GET /sync-status, GET /sync-status/{id}, POST /inventory/sync-to-shopify/{id}, POST /inventory/sync-from-shopify/{id}, GET /inventory/sync-history/{id}, POST /inventory/resolve-conflict/{id}, POST /inventory/bulk-sync-to-shopify, POST /inventory/reconcile, POST /webhooks, POST /metafields/sync-all, POST /metafields/sync/{id}, GET /inventory/sync-status, POST /translations/sync-to-shopify/{id}, POST /translations/sync-from-shopify/{id}, POST /translations/sync-all
- **Count**: 28
- **Auth**: JWT Required + Shopify HMAC
- **Status**: Active (blocked by Shopify auth for full functionality)
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-102: Shopify Theme APIs

- **File**: `apps/backend/src/api/routes/integrations/shopify_theme.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /product-availability/{sku}, POST /validate-order, POST /custom-pricing, GET /stock-check-bulk, GET /delivery-estimate
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-103: SendGrid Integration

- **File**: `apps/backend/src/api/routes/integrations/sendgrid.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /status, POST /send, GET /conversations, GET /conversations/{id}, POST /webhook/inbound, POST /webhook/events, POST /demo/simulate-inbound
- **Count**: 7
- **Auth**: JWT Required + SendGrid signature
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-104: ElevenLabs Integration

- **File**: `apps/backend/src/api/routes/integrations/elevenlabs.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /status, POST /generate, POST /stream, GET /voices, GET /models, GET /usage, POST /demo/generate
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-105: AP2 (Google Pay) Integration

- **File**: `apps/backend/src/api/routes/integrations/ap2.py`
- **Prefix**: /api/integrations
- **Endpoints**: POST /mandates/intent, POST /mandates/cart, POST /mandates/payment, POST /mandates/{id}/verify, POST /mandates/voice-payment, GET /payments/{id}, POST /voice/sessions, POST /voice/sessions/{id}/input, GET /mandates, GET /transactions, POST /webhooks
- **Count**: 11
- **Auth**: JWT Required + AP2 signature
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-106: Google AI

- **File**: `apps/backend/src/api/routes/google_ai.py`
- **Prefix**: /api
- **Endpoints**: POST /generate, POST /product-description, POST /embeddings, GET /health
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

### ROUTE-107: Marketplace

- **File**: `apps/backend/src/api/routes/integrations/marketplace.py`
- **Prefix**: /api/integrations
- **Endpoints**: GET /channels, POST /channels/{type}/connect, POST /channels/{type}/disconnect, GET /channels/{type}/products, POST /sync/products, GET /sync/status, POST /sync/inventory, GET /orders, GET /channels/{type}/setup-fields
- **Count**: 9
- **Auth**: JWT Required
- **Status**: Active
- **Registered**: Yes
- **Last Verified**: 2026-03-17

---

### Domain: Monitoring

### ROUTE-108: Monitoring Alerts

- **File**: `apps/backend/src/api/routes/monitoring/alerts.py`
- **Prefix**: /api/monitoring
- **Endpoints**: POST "", GET "", POST /{id}/acknowledge, POST /{id}/resolve, DELETE /clear-old, GET /pos-failures, GET /pos-failures/stream
- **Count**: 7
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-109: Business Metrics

- **File**: `apps/backend/src/api/routes/monitoring/business_metrics.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET /pos, GET /reconciliation, GET /orders, GET /summary
- **Count**: 4
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-110: Performance Monitoring

- **File**: `apps/backend/src/api/routes/monitoring/performance.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET "", GET /endpoints, GET /slowest, GET /errors, GET /endpoint
- **Count**: 5
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17

### ROUTE-111: Infrastructure Monitoring

- **File**: `apps/backend/src/api/routes/monitoring/infrastructure.py`
- **Prefix**: /api/monitoring
- **Endpoints**: GET /health, GET /metrics, GET /range
- **Count**: 3
- **Auth**: JWT Required
- **Status**: Active (conditional)
- **Registered**: Conditional
- **Last Verified**: 2026-03-17
