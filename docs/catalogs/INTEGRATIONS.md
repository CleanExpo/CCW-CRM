# Integrations Catalog — CCW ERP/CRM

# Last Updated: 2026-03-17

# Total Integrations: 13

# Source: apps/backend/src/integrations/ + apps/backend/src/api/routes/integrations/

---

## Integration Entries

### INT-001: Cin7 (Core + Omni)

- **Type**: Inventory Management System
- **Phases Completed**: 7 (fully implemented) + Wave 1-3 extensions
- **Backend Client**: `apps/backend/src/integrations/cin7/client.py`
- **Demo Client**: `apps/backend/src/integrations/cin7/demo_client.py`
- **Sync Modules**: product_sync.py, inventory_sync.py, customer_sync.py, sales_sync.py, supplier_sync.py, purchase_sync.py, change_detector.py, event_dispatcher.py
- **Route Files** (14 total):
  - `cin7.py` (ROUTE-086) — connection management, previews
  - `cin7_sync.py` (ROUTE-087) — product/inventory sync
  - `cin7_crm.py` (ROUTE-088) — CRM sync
  - `cin7_procurement.py` (ROUTE-089) — procurement sync
  - `cin7_webhooks.py` (ROUTE-090) — webhook receiver
  - `cin7_stream.py` (ROUTE-091) — SSE real-time events
  - `cin7_line_items.py` (ROUTE-092) — line items
  - `cin7_grn.py` (ROUTE-093) — goods receipt notes
  - `cin7_inventory_writeback.py` (ROUTE-094) — stock adjustments/transfers/takes
  - `cin7_webhook_subscriptions.py` (ROUTE-095) — webhook subscription management
  - `cin7_bom.py` (ROUTE-096) — bill of materials + production runs
  - `cin7_fulfilment.py` (ROUTE-097) — pick/pack/ship/invoice/payments
  - `cin7_shadow_sync.py` (ROUTE-098) — shadow transition gap detection
  - `cin7_gl.py` (ROUTE-099) — financial/GL integration
- **Settings**: `apps/backend/src/config/cin7_settings.py`
- **DB Models**: 18 models (MODEL-017 to MODEL-033, plus shadow + BOM + fulfilment + GL)
- **Mode**: Demo / Live
- **Auth**: Header-based (Core — DEAR API key) + Basic Auth (Omni)
- **Frontend Client**: `apps/web/lib/api/cin7.ts`
- **Frontend Hook**: `apps/web/lib/hooks/use-cin7-stream.ts`
- **AI Agents**: AGENT-007 (Cin7 Anomaly), AGENT-008 (Cin7 Forecasting), AGENT-009 (Cin7 Shadow)
- **Status**: Complete (all phases done)
- **Last Verified**: 2026-03-17

---

### INT-002: Xero

- **Type**: Accounting / ERP / Bank Feeds
- **Backend Client**: `apps/backend/src/integrations/xero/` (8 modules: auth, client, customers, demo_client, invoices, payments, pos_reconciliation, token_manager, webhook_security, webhooks)
- **Route File**: `apps/backend/src/api/routes/integrations/xero.py` (ROUTE-100) — 11 endpoints
- **DB Models**: `apps/backend/src/db/xero_models.py` (XeroConnection, Payment)
- **Auth**: OAuth 2.0
- **Features**: Contact sync, invoice sync, bank feed integration, payment reconciliation
- **Status**: Active — routes implemented
- **Last Verified**: 2026-03-17

---

### INT-003: Shopify

- **Type**: E-Commerce Platform
- **Backend Client**: `apps/backend/src/integrations/shopify/` (8 modules: client, demo_client, inventory, inventory_sync, metafields, orders, product_sync, translations, webhooks)
- **Route Files**:
  - `shopify.py` (ROUTE-101) — 28 endpoints (core, sync, metafields, translations)
  - `shopify_theme.py` (ROUTE-102) — 5 endpoints (theme APIs)
- **DB Models**: `shopify_models.py` (5 models), `shopify_extended_models.py` (5 models)
- **Auth**: Shopify HMAC webhook verification + OAuth
- **Features**: Product sync, inventory sync, order sync, webhook receiver, metafields, theme API, translations
- **Status**: Partial — routes exist; full functionality BLOCKED by Shopify auth (UNI-1236)
- **Last Verified**: 2026-03-17

---

### INT-004: Google AI (Imagen 4 + Gemini)

- **Type**: AI / Image Generation / LLM
- **Backend Client**: `apps/backend/src/integrations/google/client.py`
- **Route File**: `apps/backend/src/api/routes/google_ai.py` (ROUTE-106) — 4 endpoints
- **Auth**: Google API Key
- **Features**: Imagen 4 image generation, Gemini text generation, embeddings
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-005: ElevenLabs

- **Type**: Voice / Text-to-Speech
- **Backend Client**: `apps/backend/src/integrations/elevenlabs/` (client.py, demo_client.py, live_client.py)
- **Route File**: `apps/backend/src/api/routes/integrations/elevenlabs.py` (ROUTE-104) — 7 endpoints
- **Auth**: ElevenLabs API Key
- **Features**: Voice synthesis, streaming audio, voice model listing
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-006: SendGrid

- **Type**: Transactional Email
- **Backend Client**: `apps/backend/src/integrations/sendgrid/` (client.py, demo_client.py, live_client.py, processor.py)
- **Route File**: `apps/backend/src/api/routes/integrations/sendgrid.py` (ROUTE-103) — 7 endpoints
- **DB Models**: `email_models.py` (4 models), `email_audit_models.py` (2 models)
- **Auth**: SendGrid API Key + HMAC webhook verification
- **Features**: Email delivery, webhook tracking, email audit trail (GDPR), conversation threading
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-007: Stripe

- **Type**: Payment Processing
- **Backend Client**: `apps/backend/src/integrations/stripe/client.py`
- **Route File**: `apps/backend/src/api/routes/billing.py` (ROUTE-044) — 6 endpoints
- **DB Models**: `models/subscription.py` (Subscription model)
- **Auth**: Stripe API Key + Webhook Signing Secret
- **Features**: Subscription billing, payment methods, invoices, webhooks
- **Frontend**: `apps/web/app/(dashboard)/settings/billing/page.tsx`, `apps/web/lib/api/billing.ts`
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-008: Google AP2 (Google Pay / Frictionless Payments)

- **Type**: Payment Processing / Voice Commerce
- **Backend Client**: `apps/backend/src/integrations/ap2/` (client.py, security.py)
- **Route File**: `apps/backend/src/api/routes/integrations/ap2.py` (ROUTE-105) — 11 endpoints
- **DB Models**: `ap2_models.py` (6 models)
- **Auth**: AP2 / Google Pay credentials
- **Features**: Mandate-based payments, voice commerce, payment webhooks
- **Frontend**: `apps/web/lib/api/ap2.ts`, AP2ConnectionCard, settings/integrations/ap2/page.tsx
- **Status**: Complete (UNI-1241)
- **Last Verified**: 2026-03-17

---

### INT-009: Sentry

- **Type**: Error Tracking / Performance Monitoring
- **Backend Client**: `apps/backend/src/integrations/sentry_client.py`
- **Frontend Package**: `@sentry/nextjs` (^10.38.0)
- **Backend Package**: `sentry-sdk[fastapi]` (>=2.52.0)
- **Auth**: Sentry DSN
- **Features**: Error tracking, performance monitoring, crash reporting
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-010: Payments (Generic)

- **Type**: Payment Gateway Abstraction
- **Backend Client**: `apps/backend/src/integrations/payments/` (processor.py, eftpos.py, amex.py)
- **Features**: Generic payment processor abstraction wrapping EFTPOS and AMEX
- **Status**: Active
- **Last Verified**: 2026-03-17

---

### INT-011: Secrets Manager

- **Type**: Infrastructure / Secret Management
- **Backend Module**: `apps/backend/src/integrations/secrets_manager.py`
- **Features**: Centralized secret retrieval abstraction
- **Status**: Active (utility module)
- **Last Verified**: 2026-03-17

---

### INT-012: Marketplace (Multi-Channel)

- **Type**: Multi-Channel E-Commerce Sync
- **Backend Client**: `apps/backend/src/integrations/marketplace/` (base.py, demo_channel.py, registry.py, sync_engine.py)
- **Route File**: `apps/backend/src/api/routes/integrations/marketplace.py` (ROUTE-107) — 9 endpoints
- **DB Models**: `marketplace_models.py` (5 models)
- **Features**: Multi-channel product sync, inventory sync, order feed, channel connection management
- **Frontend**: `apps/web/app/(dashboard)/settings/integrations/marketplace/page.tsx`
- **Status**: Active (foundation complete)
- **Last Verified**: 2026-03-17

---

### INT-013: Supabase

- **Type**: Database / Auth / State Store
- **Backend Package**: `supabase>=2.0.0`
- **Frontend Package**: `@supabase/supabase-js ^2.95.3`
- **Features**: Production auth, database hosting, state storage
- **Status**: Active (production deployment)
- **Last Verified**: 2026-03-17

---

## Integration Pattern (Reference)

All integrations follow this pattern:

```
config/settings.py (Pydantic BaseSettings, mode: demo|live, global singleton)
  |
integrations/[name]/client.py (httpx.AsyncClient, async context manager, demo/live routing)
  |
api/routes/integrations/[name].py (FastAPI router, endpoint handlers)
```

- **Demo mode**: Uses structlog logging + realistic mock data matching real API shapes
- **Live mode**: Real API calls with credentials from environment
- **Settings pattern**: `mode: Literal["demo", "live"]` in each integration's settings class
- **Error handling**: All integration errors caught and returned as structured JSON
