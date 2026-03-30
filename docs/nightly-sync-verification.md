# Nightly Sync — End-to-End Verification Guide

> Run this guide to confirm the nightly data pipeline is working end-to-end
> before handing the system over to CCW.
>
> **Prerequisite**: Cin7 credentials must be set in Railway (`CIN7_MODE=live`).
> Xero can be verified once CCW completes OAuth setup.

---

## Overview of the Nightly Pipeline

```
7:00pm AEST  →  Cin7 sync  →  products + inventory + customers + orders
8:00pm AEST  →  Xero sync  →  invoices + payments (requires Xero OAuth)
9:00pm AEST  →  Auto-reorder  →  draft POs for products below threshold
9:00am AEST  →  Daily report  →  KPI refresh on dashboard
```

---

## Step 1 — Manual Trigger (Don't Wait for 7pm)

Trigger each cron job manually to verify immediately. Replace `<CRON_SECRET>` with
the value from your Vercel environment variables.

### 1a. Cin7 Sync

```bash
curl -X GET \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://ccwonline.com.au/api/cron/shadow-sync-cin7
```

**Expected response (live mode):**
```json
{
  "status": "success",
  "synced": {
    "products": 142,
    "customers": 87,
    "orders": 23,
    "inventory_locations": 3
  },
  "duration_seconds": 14.2,
  "timestamp": "2026-03-30T19:00:04Z"
}
```

**Expected response (demo mode — if still on demo):**
```json
{
  "status": "demo",
  "message": "Running in demo mode - no real data synced"
}
```

If you see the demo response: set `CIN7_MODE=live` in Railway and redeploy.

### 1b. Auto-Reorder

```bash
curl -X GET \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://ccwonline.com.au/api/cron/auto-reorder-inventory
```

**Expected response:**
```json
{
  "status": "success",
  "purchase_orders_created": 3,
  "items_below_threshold": 7,
  "timestamp": "2026-03-30T21:00:01Z"
}
```

### 1c. Daily Report

```bash
curl -X GET \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://ccwonline.com.au/api/cron/daily-report
```

**Expected response:**
```json
{
  "status": "success",
  "kpis_updated": true,
  "timestamp": "2026-03-30T09:00:01Z"
}
```

---

## Step 2 — Verify Data in the Dashboard

After triggering the Cin7 sync, confirm the data landed:

### 2a. Products

1. Go to `/products`
2. Confirm product count matches your Cin7 product count (approximately)
3. Open a product → confirm stock levels match Cin7

**Verification query (optional — Supabase SQL editor):**
```sql
SELECT COUNT(*) FROM products;
SELECT updated_at FROM products ORDER BY updated_at DESC LIMIT 5;
```

The `updated_at` timestamps should be within the last 30 minutes.

### 2b. Customers

1. Go to `/customers`
2. Search for a known customer name from Cin7
3. Confirm their company name and contact details match

**Verification query:**
```sql
SELECT COUNT(*) FROM customers;
SELECT company_name, updated_at FROM customers ORDER BY updated_at DESC LIMIT 5;
```

### 2c. Orders

1. Go to `/orders`
2. Confirm recent Cin7 orders appear
3. Check that line items are present (click an order → line items visible)

**Verification query:**
```sql
SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 2d. Inventory Levels

1. Go to `/inventory`
2. Check a product you know is in stock in Cin7
3. Stock level should match Cin7's current figure

---

## Step 3 — Verify Xero Sync (after OAuth connected)

Once CCW has connected Xero:

### 3a. Trigger Xero sync

```bash
curl -X GET \
  -H "x-cron-secret: <CRON_SECRET>" \
  https://ccwonline.com.au/api/cron/shadow-sync-xero
```

**Expected response:**
```json
{
  "status": "success",
  "invoices_synced": 45,
  "payments_synced": 38,
  "timestamp": "2026-03-30T20:00:03Z"
}
```

### 3b. Verify invoices in dashboard

1. Go to `/invoices`
2. Confirm invoices from Xero appear with correct amounts and statuses
3. Check that a known "paid" invoice in Xero shows as "paid" here
4. Check that a known "outstanding" invoice in Xero shows as "open" here

---

## Step 4 — Verify Auto-Reorder Creates Draft POs

If you have products with reorder points set:

1. Go to `/purchase-orders`
2. Filter by status: **Draft**
3. Confirm draft POs were created for products below their reorder threshold
4. Open a draft PO → correct supplier, correct items, correct quantities

**To test without waiting for real stock to be low:**
1. Go to `/products` → edit any product
2. Set **Reorder Point** to a number higher than current stock (e.g., 9999)
3. Trigger auto-reorder manually (Step 1b)
4. Confirm a draft PO is created for that product
5. Reset the reorder point back to the correct value

---

## Step 5 — Verify the Sync Log in Supabase

The system logs every sync run. Verify it's recording:

**Supabase SQL editor** (`vwfgksqkajnpfjospbpe`):

```sql
-- Check Cin7 sync log
SELECT
  sync_type,
  status,
  records_synced,
  started_at,
  completed_at,
  error_message
FROM cin7_sync_logs
ORDER BY started_at DESC
LIMIT 10;
```

**Expected**: rows with `status = 'success'` and recent `completed_at` timestamps.

If you see `status = 'error'`: check the `error_message` column for details.

---

## Step 6 — Verify Cron Jobs Are Scheduled in Vercel

1. Go to [vercel.com](https://vercel.com) → your CCW project
2. Click **Settings → Cron Jobs**
3. Confirm these jobs are listed and **Active**:

| Job | Schedule |
|---|---|
| `/api/cron/health-check` | Every 5 minutes |
| `/api/cron/retry-failed-webhooks` | Every 5 minutes |
| `/api/cron/check-sla-breaches` | Every 15 minutes |
| `/api/cron/run-autonomous-ops` | Every hour |
| `/api/cron/daily-report` | 9am daily |
| `/api/cron/check-expiring-quotes` | 9am daily |
| `/api/cron/shadow-sync-cin7` | 7pm daily |
| `/api/cron/auto-reorder-inventory` | 9pm daily |

**Xero cron jobs (add AFTER Xero is connected):**

| Job | Schedule |
|---|---|
| `/api/cron/refresh-xero-tokens` | Every 15 minutes |
| `/api/cron/shadow-sync-xero` | 8pm daily |

---

## Pass Criteria

| Check | Pass condition |
|---|---|
| Cin7 sync endpoint | Returns `"status": "success"` with record counts > 0 |
| Products in dashboard | Count ≥ 1, updated_at within last 30 min |
| Customers in dashboard | Count ≥ 1, known customer found by name |
| Orders in dashboard | Recent orders visible with line items |
| Auto-reorder | Creates draft POs for low-stock items |
| Sync log in Supabase | Rows with `status = 'success'` present |
| Vercel cron jobs | All 8 active jobs listed (10 after Xero) |
| Xero sync (when connected) | Returns invoice + payment counts > 0 |

**All checks passing = nightly pipeline verified.**

---

## Rollback if Sync Fails

If the sync runs but causes data issues:

1. **Do not delete anything** — data in Supabase is not the master (Cin7 is)
2. Re-run the sync: `GET /api/cron/shadow-sync-cin7` — it overwrites stale records
3. If the schema is the issue: contact Phill — a database migration may be needed
4. As a last resort: the Supabase dashboard has a point-in-time recovery option

---

*Last updated: 2026-03-30*
