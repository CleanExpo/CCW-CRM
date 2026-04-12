# Nightly Sync Verification Guide

**Updated**: 2026-03-30

---

## Sync Schedule

| Time (AEST) | Cron Path                                                    | What it does                                                  |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 7:00 PM     | `/api/cron/shadow-sync-cin7`                                 | Pulls products, inventory levels, customers, orders from Cin7 |
| 8:00 PM     | `/api/cron/shadow-sync-xero` (disabled until Xero connected) | Pulls invoices, payments from Xero                            |
| 9:00 PM     | `/api/cron/auto-reorder-inventory`                           | Creates draft Purchase Orders for low-stock items             |
| 9:00 AM     | `/api/cron/daily-report`                                     | Refreshes KPI metrics on Dashboard                            |

---

## How to Manually Trigger a Sync

### Option A — via Dashboard (recommended)

1. Log in to CCW Online
2. Go to **Dashboard** → **Sync Status** card
3. Click **Trigger Sync** next to the integration you want to sync
4. Wait 30-60 seconds — the status will update

### Option B — via API (for developers)

```bash
# Cin7 sync
curl -X POST https://ccwonline.com.au/api/cron/shadow-sync-cin7 \
  -H "x-cron-secret: $CRON_SECRET"

# Auto-reorder check
curl -X POST https://ccwonline.com.au/api/cron/auto-reorder-inventory \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## Verification Checklist

After triggering each sync, verify:

### Cin7 Sync (7pm)

- [ ] Products count matches Cin7 (check `/products` page)
- [ ] Stock levels updated (check `/inventory` → compare with Cin7)
- [ ] Customers synced (check `/customers` → look for recent Cin7 customers)
- [ ] Sync log: Railway Logs → filter by `shadow_sync_cin7`

### Xero Sync (8pm — after Xero is connected)

- [ ] Invoices appear in `/invoices` matching Xero
- [ ] Payment status updated correctly (paid invoices show as paid)
- [ ] Sync log: Railway Logs → filter by `xero_sync`

### Auto-Reorder (9pm)

- [ ] Go to `/purchase-orders` → check for new Draft POs created overnight
- [ ] Verify reorder thresholds match expected low-stock products
- [ ] Sync log: Railway Logs → filter by `auto_reorder`

---

## Troubleshooting

| Issue                 | Check                                | Fix                                          |
| --------------------- | ------------------------------------ | -------------------------------------------- |
| Cin7 sync not running | Railway Logs: `CIN7_API_KEY not set` | Add CIN7_API_KEY to Railway env vars         |
| Products not updating | Logs: `cin7_product_sync`            | Check Cin7 API key is for live mode          |
| Xero sync fails       | Logs: `xero_token_expired`           | Re-connect Xero in Settings → Integrations   |
| No auto-reorder POs   | Logs: check reorder threshold        | Verify reorder points set in Products → Edit |
