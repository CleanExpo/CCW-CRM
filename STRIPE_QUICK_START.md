# Stripe Billing - Quick Start Guide

**Get billing running in 10 minutes** 🚀

---

## Step 1: Create Stripe Account (2 min)

1. Go to https://dashboard.stripe.com/register
2. Sign up with email
3. Verify email
4. Skip onboarding (stay in test mode)

---

## Step 2: Get API Keys (1 min)

1. Go to https://dashboard.stripe.com/apikeys
2. Click "Reveal test key" for **Secret key**
3. Copy the key (starts with `sk_test_`)
4. Copy the **Publishable key** (starts with `pk_test_`)

---

## Step 3: Configure Environment (2 min)

Add to `apps/backend/.env`:

```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Add to `apps/web/.env.local`:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
```

---

## Step 4: Set Up Webhook (Local Testing) (2 min)

### Option A: Stripe CLI (Recommended)

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/billing/webhooks
```

Copy the webhook signing secret from output (starts with `whsec_`).

Add to `apps/backend/.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Option B: Skip (for initial testing)

You can skip webhook setup for initial testing. Webhooks are only needed for:
- Subscription status updates
- Failed payment handling
- Invoice notifications

---

## Step 5: Start Services (1 min)

```bash
# Terminal 1: Database
docker compose up -d

# Terminal 2: Backend
cd apps/backend
uvicorn src.api.main:app --reload

# Terminal 3: Frontend
cd apps/web
pnpm dev
```

---

## Step 6: Test Billing Flow (2 min)

1. **Open browser:** http://localhost:3000/settings/billing

2. **View trial subscription:**
   - Should see "Starter" plan
   - Status: TRIAL
   - Trial ends in 14 days

3. **Upgrade to Professional:**
   - Click "Select Professional" button
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits (e.g., 123)
   - Click "Add Payment Method"

4. **Verify success:**
   - Should see "Professional" plan
   - Status: ACTIVE
   - Price: $299.00/month

5. **Check usage metrics:**
   - Should see real product/order counts
   - Progress bars showing usage

6. **Test customer portal:**
   - Click "Manage Billing" button
   - Opens Stripe Customer Portal
   - Try updating payment method
   - View invoices

---

## Test Cards Reference

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0000 0000 9995` | ❌ Insufficient funds |
| `4000 0000 0000 0069` | ❌ Expired card |

Use any future expiry and any 3-digit CVC.

---

## Quick Troubleshooting

### Issue: "Missing Stripe API key"

**Solution:**
```bash
# Check environment variable is set
cd apps/backend
cat .env | grep STRIPE_SECRET_KEY
```

If empty, add your key from Step 2.

---

### Issue: "Webhook signature verification failed"

**Solution:**

**Option 1:** Use Stripe CLI
```bash
stripe listen --forward-to localhost:8000/api/billing/webhooks
# Copy the webhook secret from output
```

**Option 2:** Skip webhooks for now
- Comment out webhook signature check in `apps/backend/src/integrations/stripe/client.py`
- Only for local testing!

---

### Issue: Backend won't start - "No module named 'stripe'"

**Solution:**
```bash
cd apps/backend
pip install stripe
# OR if using uv:
uv pip install stripe
```

---

### Issue: Frontend shows "Failed to load subscription"

**Solution:**

1. Check backend is running:
   ```bash
   curl http://localhost:8000/health
   # Should return: {"status":"healthy"}
   ```

2. Check authentication:
   - Make sure you're logged in
   - Token should be in cookies
   - Try logging out and back in

3. Check backend logs for errors

---

## Next Steps

### ✅ Basic Testing Complete

You now have:
- Working subscription management
- Usage metering
- Customer portal
- Public pricing page

### 🎯 Ready for Production?

See `docs/STRIPE_BILLING.md` for:
- Creating live products/prices
- Setting up live webhooks
- Production deployment checklist
- Monitoring & alerts

### 🚀 Advanced Features

Optional enhancements:
- Replace mock payment form with Stripe Elements
- Add metered billing for API usage
- Implement usage forecasting
- Multi-currency support

---

## Support

**Quick Questions:** Check `docs/STRIPE_BILLING.md`
**Stripe Docs:** https://stripe.com/docs/billing
**Stripe Support:** https://support.stripe.com

---

## Summary

✅ **You've successfully set up Stripe billing!**

**What works now:**
- View subscription
- Upgrade/downgrade plans
- Cancel subscription
- Usage tracking
- Customer portal
- Invoice management
- Public pricing page

**Time to production:** ~2 hours (following full guide)

---

**Happy billing! 💳**
