# Integrations Catalog — CCW ERP/CRM

# Last Updated: 2026-03-03

# Total Integrations: 11

# Source: apps/backend/src/integrations/ + apps/backend/src/api/routes/integrations/

---

## Integration Entries

### INT-001: Cin7 (Core + Omni)

- **Type**: Inventory Management System
- **Phases Completed**: 7 (fully implemented)
  - Phase 1: Client — Core (DEAR header auth) + Omni (Basic Auth) unified client
  - Phase 2: Product/Inventory sync — bidirectional product + multi-location stock
  - Phase 3: CRM sync — customer, order, quote sync
  - Phase 4: Procurement sync — supplier, purchase order sync
  - Phase 5: Webhooks — inbound event receiver
  - Phase 6: SSE + polling — real-time change detection and streaming
  - Phase 7: AI agents — Cin7 forecasting + anomaly detection agents
- **Backend Client**: `apps/backend/src/integrations/cin7/client.py`
- **Demo Client**: `apps/backend/src/integrations/cin7/demo_client.py`
- **Route Files**:
  - `apps/backend/src/api/routes/integrations/cin7.py` (ROUTE-064) — connection management
  - `apps/backend/src/api/routes/integrations/cin7_sync.py` (ROUTE-065) — product/inventory sync
  - `apps/backend/src/api/routes/integrations/cin7_crm.py` (ROUTE-066) — CRM sync
  - `apps/backend/src/api/routes/integrations/cin7_procurement.py` (ROUTE-067) — procurement sync
  - `apps/backend/src/api/routes/integrations/cin7_webhooks.py` (ROUTE-068) — webhook receiver
  - `apps/backend/src/api/routes/integrations/cin7_stream.py` (ROUTE-069) — SSE real-time events
- **Settings**: `apps/backend/src/config/cin7_settings.py`
- **DB Models**: Cin7Connection, Cin7ProductMapping, Cin7CustomerMapping, Cin7OrderMapping, Cin7QuoteMapping, Cin7SupplierMapping, Cin7PurchaseOrderMapping, Cin7SyncLog (MODEL-013 to MODEL-020)
- **Mode**: Demo / Live (configurable via settings)
- **Auth**: Header-based (Cin7 Core — DEAR API key + account ID) + Basic Auth (Cin7 Omni)
- **Frontend Client**: `apps/web/lib/api/cin7.ts`
- **Frontend Hook**: `apps/web/lib/hooks/use-cin7-stream.ts`
- **Dashboard Widget**: `apps/web/components/dashboard/Cin7SyncStatusWidget.tsx`
- **AI Agents**: AGENT-007 (Cin7 Anomaly), AGENT-008 (Cin7 Forecasting)
- **Status**: Complete (all 7 phases done)
- **Last Verified**: 2026-03-03

---

### INT-002: Xero

- **Type**: Accounting / ERP / Bank Feeds
- **Backend Client**: `apps/backend/src/integrations/xero/`
- **Route File**: `apps/backend/src/api/routes/integrations/xero.py` (ROUTE-070)
- **DB Models**: `apps/backend/src/db/xero_models.py` (Xero-specific models + schemas)
- **Core Fields on Existing Models**: Customer.xero_contact_id, Order.xero_invoice_id (in demo_models.py)
- **Auth**: OAuth 2.0 (Xero Connect)
- **Features**: Contact sync, invoice sync, bank feed integration, payment reconciliation
- **Status**: Active — routes implemented; depth of sync coverage may vary
- **Last Verified**: 2026-03-03

---

### INT-003: Shopify

- **Type**: E-Commerce Platform
- **Backend Client**: `apps/backend/src/integrations/shopify/`
- **Route Files**:
  - `apps/backend/src/api/routes/integrations/shopify.py` (ROUTE-071) — core integration
  - `apps/backend/src/api/routes/integrations/shopify_theme.py` (ROUTE-072) — theme APIs
- **DB Models**: `apps/backend/src/db/shopify_models.py`, `apps/backend/src/db/shopify_extended_models.py`
- **Auth**: Shopify HMAC webhook verification + OAuth (UNI-1236 prerequisite unresolved)
- **Features**: Product sync, inventory sync, order sync, webhook receiver, theme API (metafields)
- **Status**: Partial — routes exist and are registered; full functionality BLOCKED by Shopify auth prerequisite (UNI-1236)
- **Last Verified**: 2026-03-03

---

### INT-004: Google AI (Imagen 4 + Gemini)

- **Type**: AI / Image Generation / LLM
- **Backend Client**: `apps/backend/src/integrations/google/`
- **Route File**: `apps/backend/src/api/routes/google_ai.py` (ROUTE-077)
- **Auth**: Google API Key
- **Features**:
  - Imagen 4: Product image generation, marketing asset creation
  - Gemini 2.5 Pro: Text generation, content creation, analysis
- **Documentation**: `docs/MODEL_ROUTING.md` (updated with Imagen 4 + Gemini 2.5 Pro routing)
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### INT-005: ElevenLabs

- **Type**: Voice / Text-to-Speech
- **Backend Client**: `apps/backend/src/integrations/elevenlabs/`
- **Route File**: `apps/backend/src/api/routes/integrations/elevenlabs.py` (ROUTE-074)
- **Auth**: ElevenLabs API Key
- **Features**: Voice synthesis for product descriptions, demo narration, voice commerce
- **Status**: Active — routes registered
- **Last Verified**: 2026-03-03

---

### INT-006: SendGrid

- **Type**: Transactional Email
- **Backend Client**: `apps/backend/src/integrations/sendgrid/`
- **Route File**: `apps/backend/src/api/routes/integrations/sendgrid.py` (ROUTE-073)
- **DB Models**: `apps/backend/src/db/email_models.py`, `apps/backend/src/db/email_audit_models.py`
- **Auth**: SendGrid API Key + HMAC webhook verification
- **Features**: Transactional email delivery, webhook tracking (delivery/open/click events), email audit trail (ISS-037 — GDPR compliance)
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### INT-007: Stripe

- **Type**: Payment Processing
- **Backend Client**: `apps/backend/src/integrations/stripe/`
- **Route File**: `apps/backend/src/api/routes/billing.py` — subscription management
- **DB Models**: `apps/backend/src/db/models/subscription.py` (Subscription, SubscriptionTier, SubscriptionStatus, BillingInterval), References in webhook_models.py (WebhookSource.STRIPE)
- **Package**: stripe>=7.0.0 (in pyproject.toml)
- **Auth**: Stripe API Key + Webhook Signing Secret
- **Features**: Subscription billing (Starter/Pro/Enterprise/Custom tiers), payment method management, invoice retrieval, webhook handling
- **Frontend**: `apps/web/app/(dashboard)/settings/billing/page.tsx`, `apps/web/lib/api/billing.ts`
- **Status**: Active — billing router enabled, frontend billing UI complete
- **Last Verified**: 2026-03-03

---

### INT-008: Google AP2 (Google Pay / Frictionless Payments)

- **Type**: Payment Processing / Voice Commerce
- **Backend Client**: `apps/backend/src/integrations/ap2/`
- **Route File**: `apps/backend/src/api/routes/integrations/ap2.py` (ROUTE-075)
- **DB Models**: `apps/backend/src/db/ap2_models.py`
- **Auth**: AP2 / Google Pay credentials
- **Features**: Frictionless payment processing, voice commerce, payment webhooks
- **Frontend API Client**: `apps/web/lib/api/ap2.ts`
- **Frontend Card**: `apps/web/app/(dashboard)/settings/integrations/components/AP2ConnectionCard.tsx`
- **Frontend Page**: Added to `apps/web/app/(dashboard)/settings/integrations/page.tsx`
- **Demo Flow**: Interactive 3-step mandate chain (Intent → Cart → Payment) in dialog
- **Status**: Complete (UNI-1241 Done)
- **Last Verified**: 2026-03-03

---

### INT-009: Sentry

- **Type**: Error Tracking / Performance Monitoring
- **Backend Client**: `apps/backend/src/integrations/sentry_client.py`
- **Frontend Package**: `@sentry/nextjs` (PKG-021)
- **Auth**: Sentry DSN (environment variable)
- **Features**: Error tracking, performance monitoring, crash reporting for both frontend and backend
- **Initialized**: On startup in main.py lifespan (gracefully handles missing DSN)
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### INT-010: Payments (Generic)

- **Type**: Payment Gateway Abstraction
- **Backend Client**: `apps/backend/src/integrations/payments/`
- **Notes**: Generic payments abstraction layer — likely wraps AP2 and/or Stripe
- **Status**: Present in integrations directory — implementation depth to be verified
- **Last Verified**: 2026-03-03

---

### INT-011: Secrets Manager

- **Type**: Infrastructure / Secret Management
- **Backend Module**: `apps/backend/src/integrations/secrets_manager.py`
- **Purpose**: Centralized secret retrieval — abstracts environment variable fetching and may support cloud secret managers
- **Status**: Active (utility module, not a route)
- **Last Verified**: 2026-03-03

---

## Integration Pattern (Reference)

All integrations follow this pattern:

```
config/settings.py (Pydantic BaseSettings, mode: demo|live, global singleton)
  ↓
integrations/[name]/client.py (httpx.AsyncClient, async context manager, demo/live routing)
  ↓
api/routes/integrations/[name].py (FastAPI router, endpoint handlers)
```

- **Demo mode**: Uses structlog logging + realistic mock data matching real API shapes
- **Live mode**: Real API calls with credentials from environment
- **Settings pattern**: `mode: Literal["demo", "live"]` in each integration's settings class
- **Error handling**: All integration errors caught and returned as structured JSON (no HTML error pages)
