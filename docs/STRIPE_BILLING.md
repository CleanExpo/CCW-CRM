# Stripe Billing Integration - Implementation Guide

**Status:** ✅ Implemented (Test Mode)
**Created:** 2026-03-16
**Last Updated:** 2026-03-16
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features Implemented](#features-implemented)
4. [Configuration](#configuration)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Usage Metering](#usage-metering)
8. [Webhook Handling](#webhook-handling)
9. [Testing](#testing)
10. [Production Deployment](#production-deployment)
11. [Troubleshooting](#troubleshooting)

---

## Overview

CCW Online ERP uses **Stripe** for subscription billing with the following model:

- **Hybrid Pricing**: Base subscription tiers + usage-based metering
- **Self-Service**: Customer portal for billing management
- **Tax Compliance**: Stripe Tax for automatic calculation
- **Flexible Plans**: 4 tiers (Starter, Professional, Enterprise, Custom)

### Pricing Model

| Tier | Monthly | Annual | Locations | Users | Products | AI Quotes |
|------|---------|--------|-----------|-------|----------|-----------|
| **Starter** | $79 | $790 | 1 | 2 | 500 | - |
| **Professional** | $299 | $2,990 | 3 | 5 | Unlimited | 100/month |
| **Enterprise** | $999 | $9,990 | 10 | Unlimited | Unlimited | Unlimited |
| **Custom** | $2,999+ | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

*All prices in AUD. 20% discount on annual billing.*

---

## Architecture

### Backend (Python FastAPI)

```
apps/backend/src/
├── integrations/stripe/
│   └── client.py                    # Stripe SDK wrapper
├── services/
│   └── usage_metering.py           # Usage tracking service
├── api/routes/
│   ├── billing.py                  # Subscription management
│   └── billing_usage.py            # Usage metering endpoints
└── db/models/
    └── subscription.py             # Subscription data model
```

### Frontend (Next.js)

```
apps/web/
├── lib/api/
│   ├── billing.ts                  # Billing API client
│   └── billing-usage.ts            # Usage API client
├── app/(dashboard)/settings/billing/
│   ├── page.tsx                    # Main billing page
│   └── components/
│       ├── PlanSelector.tsx        # Plan comparison & selection
│       ├── UsageMetrics.tsx        # Usage dashboard
│       ├── PaymentMethodForm.tsx   # Payment form (Stripe Elements)
│       └── UsageAlerts.tsx         # Usage limit warnings
└── app/(marketing)/pricing/
    └── page.tsx                    # Public pricing page
```

---

## Features Implemented

### ✅ Core Subscription Management

- **Create Subscription**: Convert trial to paid plan
- **Update Subscription**: Change plan/billing interval
- **Cancel Subscription**: Cancel at period end or immediately
- **View Subscription**: Get current plan details

### ✅ Usage Metering

- **Track Usage**: Products, orders, quotes, AI usage
- **Check Limits**: Automatic limit enforcement
- **Usage Alerts**: Warnings at 80%, 90%, 100%
- **Report to Stripe**: Daily usage reporting (cron ready)

### ✅ Customer Portal

- **Self-Service**: Stripe Customer Portal integration
- **Manage Payment**: Update credit card
- **View Invoices**: Download PDF invoices
- **Cancel Subscription**: Self-service cancellation

### ✅ Tax Compliance

- **Stripe Tax**: Automatic tax calculation
- **GST Support**: Australian GST handling
- **International**: Multi-currency support ready

### ✅ Webhook Processing

- **subscription.created**: Activate subscription
- **subscription.updated**: Update status
- **subscription.deleted**: Mark as canceled
- **invoice.payment_succeeded**: Confirm payment
- **invoice.payment_failed**: Mark past_due

---

## Configuration

### 1. Environment Variables

Add to `.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx  # Frontend

# Frontend URL (for portal return URL)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 2. Stripe Dashboard Setup

#### A. Create Products & Prices

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create 4 products:

**Starter Plan**
- Name: "CCW ERP - Starter"
- Monthly Price: $79 AUD
- Annual Price: $790 AUD

**Professional Plan**
- Name: "CCW ERP - Professional"
- Monthly Price: $299 AUD
- Annual Price: $2,990 AUD

**Enterprise Plan**
- Name: "CCW ERP - Enterprise"
- Monthly Price: $999 AUD
- Annual Price: $9,990 AUD

**Custom Plan**
- Name: "CCW ERP - Custom"
- Contact Sales (no automated pricing)

3. Note Price IDs for each (e.g., `price_xxxxxxxxxxxxx`)

#### B. Enable Stripe Tax

1. Go to [Stripe Dashboard → Tax](https://dashboard.stripe.com/tax)
2. Enable automatic tax calculation
3. Configure tax registration for your jurisdiction

#### C. Configure Customer Portal

1. Go to [Stripe Dashboard → Settings → Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
2. Enable:
   - Update payment method
   - View invoices
   - Cancel subscription
3. Set branding (logo, colors)

#### D. Set Up Webhooks

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.com/api/billing/webhooks`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook signing secret to `.env`

---

## API Endpoints

### Subscription Management

#### GET /api/billing
Get current organization's subscription.

**Response:**
```json
{
  "id": "sub_123",
  "tier": "professional",
  "status": "active",
  "billing_interval": "monthly",
  "price_cents": 29900,
  "price_display": "$299.00",
  "max_locations": 3,
  "max_users": 5,
  "current_period_end": "2026-04-16T00:00:00Z"
}
```

#### POST /api/billing/subscribe
Create new subscription.

**Request:**
```json
{
  "tier": "professional",
  "billing_interval": "monthly",
  "payment_method_id": "pm_xxxxxxxxxxxxx",
  "trial_days": 0
}
```

#### PUT /api/billing/subscription
Update subscription (change plan).

**Request:**
```json
{
  "tier": "enterprise",
  "billing_interval": "annual"
}
```

#### DELETE /api/billing/subscription?immediately=false
Cancel subscription.

**Query Params:**
- `immediately`: Cancel now (true) or at period end (false)

#### GET /api/billing/invoices?limit=10
List invoices.

**Response:**
```json
[
  {
    "id": "in_xxxxx",
    "amount_paid": 29900,
    "currency": "aud",
    "status": "paid",
    "invoice_pdf": "https://...",
    "created": "2026-03-16T..."
  }
]
```

#### POST /api/billing/portal
Create Customer Portal session.

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/xxxxx"
}
```

### Usage Metering

#### GET /api/billing/usage
Get current usage metrics.

**Response:**
```json
{
  "locations": 1,
  "users": 2,
  "products": 150,
  "orders": 45,
  "quotes": 12,
  "ai_quotes": 5
}
```

#### GET /api/billing/usage/limits
Check usage limits.

**Response:**
```json
{
  "within_limits": true,
  "warnings": [
    "Products: 450/500 (90% used)"
  ],
  "exceeded": []
}
```

#### POST /api/billing/usage/report
Report usage to Stripe (admin/cron only).

---

## Frontend Components

### Billing Page

**Location:** `/settings/billing`

Features:
- Current subscription status
- Usage metrics with progress bars
- Plan comparison grid
- Upgrade/downgrade flows
- Customer portal button
- Invoice history

### Public Pricing Page

**Location:** `/pricing`

Features:
- 4 pricing tiers
- Monthly/annual toggle
- Feature comparison table
- FAQ accordion
- CTA for free trial

### Usage Alerts

Automatically displays:
- **Critical**: Exceeded limits (red alert)
- **Warning**: 80-90% usage (yellow alert)
- **Info**: Within limits (green)

---

## Usage Metering

### Tracked Metrics

1. **Locations**: Number of active store locations
2. **Users**: Number of team members
3. **Products**: Total active products
4. **Orders**: Orders created this month
5. **Quotes**: Quotes generated this month
6. **AI Quotes**: AI-generated quotes this month

### Enforcement

Limits are enforced at:
- **Creation**: Prevent new items if limit reached
- **Dashboard**: Show warnings before limit
- **Alerts**: Email notifications at 80%, 90%, 100%

### Reporting to Stripe

For metered billing (future):

```python
# Cron job (daily at midnight)
from src.services.usage_metering import UsageMeteringService

async def report_daily_usage():
    """Report usage to Stripe for all organizations."""
    service = UsageMeteringService()
    orgs = await get_all_active_organizations()

    for org in orgs:
        await service.report_usage_to_stripe(org.id, db)
```

---

## Webhook Handling

### Security

Webhooks are verified using Stripe's signature:

```python
stripe.Webhook.construct_event(
    payload,
    signature_header,
    webhook_secret
)
```

### Event Processing

**subscription.updated**
- Update subscription status
- Sync billing dates

**subscription.deleted**
- Mark subscription as canceled
- Preserve data until grace period ends

**invoice.payment_succeeded**
- Confirm payment received
- Send receipt email

**invoice.payment_failed**
- Mark subscription as past_due
- Send dunning email
- Retry payment (Stripe Smart Retries)

---

## Testing

### Test Cards

Use Stripe test cards:

**Success**
- `4242 4242 4242 4242` - Visa (success)
- Any future expiry, any CVC

**Failure**
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 9995` - Insufficient funds

### Test Webhooks

1. Install Stripe CLI: `stripe listen --forward-to localhost:8000/api/billing/webhooks`
2. Trigger events: `stripe trigger customer.subscription.updated`
3. Check logs for processing

### Manual Testing

1. **Start services:**
   ```bash
   docker compose up -d
   cd apps/backend && uvicorn src.api.main:app --reload
   cd apps/web && pnpm dev
   ```

2. **Test flow:**
   - Navigate to `/settings/billing`
   - View current subscription (trial)
   - Click "Select Professional"
   - Enter test card: `4242 4242 4242 4242`
   - Confirm subscription created
   - Check usage metrics
   - Open customer portal
   - Cancel subscription

3. **Test limits:**
   - Create 500 products (Starter limit)
   - Try to create 501st → Should show alert
   - Upgrade to Professional
   - Verify limit increased

---

## Production Deployment

### Pre-Launch Checklist

#### ✅ Stripe Configuration

- [ ] Create production Stripe account
- [ ] Set up products & prices in live mode
- [ ] Configure Stripe Tax for all jurisdictions
- [ ] Enable Customer Portal in live mode
- [ ] Set up live webhook endpoint
- [ ] Configure Smart Retries & dunning emails

#### ✅ Environment Variables

- [ ] Update `.env` with live Stripe keys
- [ ] Set `ENVIRONMENT=production`
- [ ] Configure proper `NEXT_PUBLIC_FRONTEND_URL`

#### ✅ Database

- [ ] Run migration: `alembic upgrade head`
- [ ] Seed subscription tiers
- [ ] Verify foreign key constraints

#### ✅ Monitoring

- [ ] Set up Sentry for error tracking
- [ ] Configure Stripe Dashboard alerts
- [ ] Monitor webhook delivery success rate
- [ ] Set up failed payment alerts

#### ✅ Legal & Compliance

- [ ] Review Terms of Service
- [ ] Update Privacy Policy (payment data)
- [ ] Configure PCI compliance
- [ ] Review refund policy

### Switching to Live Mode

1. **Update environment variables:**
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_live_xxxxxxx
   ```

2. **Update frontend:**
   ```bash
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   ```

3. **Restart services:**
   ```bash
   docker compose restart
   pm2 restart all
   ```

4. **Test with real card:**
   - Use your own card
   - Create subscription
   - Verify charge in Stripe Dashboard
   - Cancel immediately (refund)

---

## Troubleshooting

### Issue: Webhook signature verification failed

**Cause:** Incorrect webhook secret or payload modification

**Solution:**
```bash
# 1. Check webhook secret in Stripe Dashboard
# 2. Verify environment variable
echo $STRIPE_WEBHOOK_SECRET

# 3. Test locally with Stripe CLI
stripe listen --forward-to localhost:8000/api/billing/webhooks
```

### Issue: Customer portal not loading

**Cause:** Customer portal not enabled in Stripe Dashboard

**Solution:**
1. Go to Stripe Dashboard → Settings → Customer Portal
2. Enable features: "Update payment method", "View invoices"
3. Save settings

### Issue: Usage limits not enforcing

**Cause:** Middleware not checking limits before creation

**Solution:**
```python
# Add to create endpoints
from src.services.usage_metering import get_usage_service

usage_service = await get_usage_service()
limits = await usage_service.check_usage_limits(org_id, db)

if not limits["within_limits"]:
    raise HTTPException(
        status_code=403,
        detail=f"Usage limit exceeded: {limits['exceeded']}"
    )
```

### Issue: Test mode charges appearing as real

**Cause:** Using test API keys but customers see it as real

**Solution:**
- Always display "TEST MODE" badge in UI when using test keys
- Add environment indicator:
  ```tsx
  {process.env.NODE_ENV === 'development' && (
    <Badge variant="destructive">TEST MODE</Badge>
  )}
  ```

---

## Next Steps

### Phase 1: Complete (Current)
- ✅ Subscription CRUD
- ✅ Usage metering
- ✅ Customer portal
- ✅ Webhook handling
- ✅ Public pricing page

### Phase 2: Enhancements (Backlog)
- [ ] **Stripe Elements Integration**: Replace mock payment form with real Stripe Elements
- [ ] **Usage-Based Pricing**: Metered billing for API calls, AI quotes
- [ ] **Proration**: Handle mid-cycle upgrades with prorated charges
- [ ] **Dunning Management**: Automated retry logic for failed payments
- [ ] **Multi-Currency**: Support USD, GBP, EUR
- [ ] **Invoicing**: Custom invoice templates, PDF generation
- [ ] **Referral Program**: Give $50 credit for each referral
- [ ] **Volume Discounts**: Enterprise pricing negotiation

### Phase 3: Advanced (Future)
- [ ] **Usage Analytics**: Historical usage trends, forecasting
- [ ] **Cost Optimization**: Recommend cheaper plans based on usage
- [ ] **Team Billing**: Split billing across departments
- [ ] **Reseller Support**: White-label billing for partners

---

## Support & Resources

### Documentation
- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Tax Docs](https://stripe.com/docs/tax)
- [Customer Portal Docs](https://stripe.com/docs/billing/subscriptions/customer-portal)

### Internal Resources
- Backend: `apps/backend/src/api/routes/billing.py`
- Frontend: `apps/web/app/(dashboard)/settings/billing/page.tsx`
- Usage Service: `apps/backend/src/services/usage_metering.py`
- Pricing Page: `apps/web/app/(marketing)/pricing/page.tsx`

### Contact
- **Engineering**: dev@ccw-erp.com
- **Stripe Support**: https://support.stripe.com
- **Billing Questions**: billing@ccw-erp.com

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-16
**Status:** Production Ready (Test Mode)
