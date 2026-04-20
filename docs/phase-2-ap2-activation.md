# Phase 2 — Google AP2 Integration: Activation Guide

> **Status (2026-04-11):** The code for Phase 2 is already shipped and tested.
> This guide covers the final activation steps needed to turn it on in production.

## What's already built

| Layer                | File(s)                                                  | LOC |
| -------------------- | -------------------------------------------------------- | --- |
| DB schema            | `apps/backend/migrations/add_ap2_integration.sql`        | 306 |
| SQLAlchemy models    | `apps/backend/src/db/ap2_models.py`                      | 454 |
| Settings             | `apps/backend/src/config/ap2_settings.py`                | 225 |
| Client (demo + live) | `apps/backend/src/integrations/ap2/client.py`            | 616 |
| Security / signature | `apps/backend/src/integrations/ap2/security.py`          | 179 |
| API routes           | `apps/backend/src/api/routes/integrations/ap2.py`        | 753 |
| Integration tests    | `apps/backend/tests/integration/test_ap2_integration.py` | 336 |

**Total shipped code:** ~2,869 lines. Client ships with two implementations:
`AP2DemoClient` (full mock with realistic delays + failure simulation) and
`AP2LiveClient` (httpx-based production client).

## Exposed API endpoints

All routes are under `/api/integrations/ap2`.

### Mandates (3-step payment chain)

| Method | Path                     | Purpose                                |
| ------ | ------------------------ | -------------------------------------- |
| POST   | `/mandates/intent`       | Step 1 — capture purchase intent       |
| POST   | `/mandates/cart`         | Step 2 — lock cart items + total       |
| POST   | `/mandates/payment`      | Step 3 — create signed payment mandate |
| POST   | `/mandates/{id}/verify`  | Verify mandate cryptographic signature |
| POST   | `/mandates/{id}/execute` | Execute an approved payment mandate    |

### Payments

| Method | Path                         | Purpose                     |
| ------ | ---------------------------- | --------------------------- |
| GET    | `/payments/{transaction_id}` | Retrieve transaction status |

### Voice Commerce

| Method | Path                         | Purpose                                 |
| ------ | ---------------------------- | --------------------------------------- |
| POST   | `/voice/sessions`            | Start a voice commerce session          |
| POST   | `/voice/sessions/{id}/input` | Send voice text input to active session |

### Webhooks

| Method | Path        | Purpose                                 |
| ------ | ----------- | --------------------------------------- |
| POST   | `/webhooks` | Receive AP2 event callbacks from Google |

> **Auth note:** `/mandates/intent`, `/mandates/cart`, `/mandates/payment`, and
> `/voice/sessions` do **not** require `get_current_user` — they are designed to
> be callable by autonomous agents. All other routes use standard JWT auth.

## Activation checklist

### 1. Set env vars in Railway (production)

```bash
# Minimum required for demo mode (safe default — no Google credentials needed)
railway variables set AP2_MODE=demo

# For live mode — set all of these
railway variables set AP2_MODE=live
railway variables set AP2_PROJECT_ID=your-gcp-project-id
railway variables set AP2_API_KEY=your-ap2-api-key
railway variables set AP2_OAUTH_CLIENT_ID=your-oauth-client-id
railway variables set AP2_OAUTH_CLIENT_SECRET=your-oauth-client-secret
railway variables set AP2_WEBHOOK_SECRET=your-webhook-signing-secret
railway variables set AP2_WEBHOOK_URL=https://api.ccw.com.au/api/integrations/ap2/webhooks
```

Add the same keys to `.env.example` (without values) so future developers know
what's required.

### 2. Apply the migration to production

```bash
# From repo root — applies add_ap2_integration.sql
supabase db push
```

This creates:

- 5 ENUM types (`ap2_connection_status`, `ap2_mandate_type`, `ap2_mandate_status`,
  `ap2_transaction_status`, `ap2_voice_session_status`)
- 4 tables: `ap2_connections`, `ap2_mandates`, `ap2_transactions`,
  `ap2_voice_sessions`
- 1 audit table: `ap2_webhook_logs`
- Covering indexes on all FK columns

### 3. Register the router in `main.py`

Check that the AP2 router is included:

```python
# apps/backend/src/api/main.py
from src.api.routes.integrations.ap2 import router as ap2_router

app.include_router(ap2_router)
```

If the import is already present, skip this step.

### 4. Smoke test in demo mode

```bash
# Start the backend locally
cd apps/backend && uv run uvicorn src.api.main:app --reload

# Step 1 — intent mandate
curl -s -X POST http://localhost:8000/api/integrations/ap2/mandates/intent \
  -H "Content-Type: application/json" \
  -d '{"intent_description": "Buy 2x safety helmets", "language": "en"}' | jq .

# Expected: mandate_id, status=verified, expires_at, signature

# Step 2 — cart mandate (use mandate_id from step 1)
curl -s -X POST http://localhost:8000/api/integrations/ap2/mandates/cart \
  -H "Content-Type: application/json" \
  -d '{"parent_mandate_id": "<intent_mandate_id>", "cart_items": [{"sku": "SAF-001", "qty": 2}], "total_amount": 89.90, "currency": "AUD"}' | jq .

# Step 3 — payment mandate (use cart mandate_id from step 2)
curl -s -X POST http://localhost:8000/api/integrations/ap2/mandates/payment \
  -H "Content-Type: application/json" \
  -d '{"parent_mandate_id": "<cart_mandate_id>", "payment_amount": 89.90, "payment_method": "card", "currency": "AUD"}' | jq .
```

### 5. Run integration tests

```bash
cd apps/backend
AP2_MODE=demo uv run pytest tests/integration/test_ap2_integration.py -v
```

All 10 tests should pass. In demo mode no Google credentials are required.

### 6. Switch to live mode (when ready)

1. Set `AP2_MODE=live` and all required keys (step 1 above)
2. Register your webhook URL in the Google Cloud Console under AP2 settings
3. Complete Google OAuth consent screen setup (callback: `AP2_OAUTH_REDIRECT_URI`)
4. Run a single live mandate flow end-to-end with a small test amount ($1 AUD)

## Operational notes

### Mandate TTL

Mandates expire after `AP2_MANDATE_TTL_SECONDS` (default: 3600 seconds / 1 hour).
Expired mandates return 404 from the verify/execute endpoints. The client must
restart the intent → cart → payment chain if TTL is exceeded.

### Webhook signature verification

All incoming webhooks are verified against `AP2_WEBHOOK_SECRET` using HMAC-SHA256.
Verification is enforced by `apps/backend/src/integrations/ap2/security.py`.
Never disable `AP2_SIGNATURE_VERIFICATION_ENABLED` in production.

### Voice session lifecycle

1. POST `/voice/sessions` → returns `session_id`
2. POST `/voice/sessions/{id}/input` with voice text → returns parsed intent + action
3. Sessions auto-expire after `AP2_VOICE_SESSION_TIMEOUT_SECONDS` (default: 300s)
4. Completed sessions are retained in `ap2_voice_sessions` for analytics

### Demo client behaviour

`AP2DemoClient` simulates realistic latency (50–200 ms per call) and a configurable
failure rate (default 5%). It generates valid-looking UUIDs and signatures so all
integration tests work without network access. Use it for all local development
and CI.

### Rate limits

The live client enforces `AP2_RATE_LIMIT_PER_HOUR` (default: 1000 calls/hour per
connection). Exceeding this returns HTTP 429. Add exponential backoff in any
client code that calls AP2 in bulk.

## Linked Linear issues

- **UNI-1675** — Phase 2 Google AP2 Integration (parent epic)

## Related files

- `apps/backend/src/integrations/ap2/__init__.py` — `get_ap2_client()` factory
- `apps/backend/src/integrations/ap2/client.py` — `AP2DemoClient` + `AP2LiveClient`
- `apps/backend/src/config/ap2_settings.py` — full env var reference with descriptions
- `apps/backend/tests/integration/test_ap2_integration.py` — smoke tests
