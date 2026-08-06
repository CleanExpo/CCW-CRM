# CCW ERP/CRM — Production Smoke Test

> Run this checklist after every deployment and before handing over to CCW.
> All 15 checks must pass before marking the system production-ready.
> **Environment**: https://ccwonline.com.au

---

## Pre-Test Setup

- [ ] Backend is deployed and healthy: `GET https://<backend-url>/health` → `{"status": "ok"}`
- [ ] All integration env vars are set in Railway and Vercel
- [ ] Test user credentials ready: admin@demo.com / (set by CCW admin)

---

## Smoke Test Checklist

### 1. Landing Page Loads

- [ ] Navigate to `https://ccwonline.com.au`
- [ ] Page renders without white screen or JavaScript error
- [ ] No "Failed to fetch" banners
- [ ] Hero section and CTA visible

### 2. Login Works

- [ ] Navigate to `/login`
- [ ] Enter valid credentials → redirected to `/dashboard`
- [ ] Invalid credentials → shows error message (not a crash)
- [ ] JWT token stored in cookies (DevTools → Application → Cookies)

### 3. Dashboard Loads with Real Data

- [ ] `/dashboard` loads within 3 seconds
- [ ] Revenue KPI card shows a number (not 0 or N/A)
- [ ] Orders KPI card shows a number
- [ ] At least one chart renders
- [ ] Cin7 sync widget shows a "last synced" timestamp

### 4. Products Page — CRUD

- [ ] `/products` loads with at least one product
- [ ] Search works (type a product name → filtered results)
- [ ] Click a product → detail page (`/products/[id]`) loads
- [ ] Edit a product (change description) → save → change persists on refresh

### 5. Customers Page — CRUD

- [ ] `/customers` loads with at least one customer
- [ ] Click a customer → `/customers/[id]` detail page loads
- [ ] Customer shows order history and contact info
- [ ] Add a note in the activity timeline → note saves

### 6. Create a Quote

- [ ] Navigate to `/quotes` → click "New Quote"
- [ ] Select a customer
- [ ] Add at least one line item (search for a product)
- [ ] Save as draft → appears in quotes list
- [ ] Open the quote → "Convert to Order" button is visible

### 7. Create an Order

- [ ] Convert the test quote to an order (from step 6), OR
- [ ] Navigate to `/orders` → "New Order" → fill in customer + items → save
- [ ] Order appears in `/orders` list with status "draft"
- [ ] Generate invoice from order → invoice appears in `/invoices`

### 8. POS — Process a Sale

- [ ] Navigate to `/pos`
- [ ] POS terminal loads (no blank screen)
- [ ] Search for a product → add to cart
- [ ] Set quantity to 2
- [ ] Select payment method: Cash
- [ ] Complete sale → receipt screen shows
- [ ] Inventory count for that product decreased by 2

### 9. Invoices Page

- [ ] `/invoices` loads with at least one invoice
- [ ] Click an invoice → detail page loads with line items
- [ ] Mark an invoice as paid → status updates
- [ ] Print view works: `/invoices/[id]` → click Print → layout correct

### 10. Settings → Integrations

- [ ] `/settings/integrations` loads
- [ ] Cin7 card shows connection status (Connected / Demo)
- [ ] Xero card shows connection status
- [ ] Shopify card shows connection status
- [ ] No cards show a crash or unhandled error

### 11. All Cron Endpoints Return 200

The handlers authenticate on `Authorization: Bearer $CRON_SECRET`. An `x-cron-secret` header —
which earlier revisions of this checklist told you to send — is ignored and returns 401 for every
endpoint, so this step could never pass as previously written.

Do not maintain the endpoint list by hand; derive it from `vercel.json` so it cannot drift:

```bash
for p in $(python3 -c "import json;print('\n'.join(c['path'] for c in json.load(open('vercel.json'))['crons']))"); do
  printf '%-46s ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' \
    -H "Authorization: Bearer $CRON_SECRET" "https://ccwonline.com.au$p"
done
```

- [ ] Every path returns 200. A **501** means the route is a stub that cannot do its job — that is
      the failure this checklist exists to catch. A **401** means `CRON_SECRET` is wrong or unset
      locally, not that the endpoint is broken.
- [ ] `/api/cron/health-check` → `{"status": "ok"}`
- [ ] `/api/cron/nightly-full-sync` → reports per-entity results; `complete: false` with a
      `next_page` is a resuming run, not a failure
- [ ] `/api/cron/daily-report` → `{"status": "success"}`

Eight endpoints that used to be listed here (`shadow-sync-cin7`, `shadow-sync-xero`,
`auto-reorder-inventory`, and five others) were removed on 2026-08-07 because they returned 501.
See `docs/nightly-sync-verification.md`.

### 12. Sidebar — No 404 Links

Click each sidebar section and verify no page throws a 404 or crashes:

- [ ] Dashboard
- [ ] Products
- [ ] Customers
- [ ] Orders
- [ ] Quotes
- [ ] Invoices
- [ ] Purchase Orders
- [ ] Suppliers
- [ ] Inventory
- [ ] POS
- [ ] Reports
- [ ] Workshop
- [ ] Settings → Integrations
- [ ] Settings → Team

### 13. CSV Export Works

- [ ] Go to `/products` → click "Export CSV" → file downloads with correct data
- [ ] Go to `/customers` → click "Export CSV" → file downloads
- [ ] Go to `/orders` → click "Export CSV" → file downloads

### 14. Mobile Viewport

- [ ] Open DevTools → toggle device toolbar → set to iPhone 14 (390px)
- [ ] Dashboard renders without horizontal scroll
- [ ] Sidebar collapses to hamburger menu
- [ ] POS works on mobile viewport (touch targets large enough)
- [ ] Tables are horizontally scrollable (not cut off)

### 15. No 5xx Errors in Logs

- [ ] Open Vercel → your project → Functions → Logs
- [ ] Filter last 1 hour
- [ ] Confirm no 500/503 errors in any API route
- [ ] Open Railway → your service → Logs
- [ ] Confirm no Python tracebacks or database connection errors

---

## Pass Criteria

**All 15 items checked = Production Ready**

If any check fails:

1. Note which check failed and the exact error message
2. Open Railway/Vercel logs for that specific time
3. Log a Linear issue: project **CCW-ERP**, team **Unite-Group**
4. Do not proceed with CCW handover until all 15 pass

---

## Post-Go-Live Monitoring (First 48 Hours)

After handing over to CCW:

- [ ] Watch Vercel logs for error spikes (first morning after go-live)
- [ ] Confirm the first real nightly Cin7 sync runs at 7pm AEST and succeeds
- [ ] Confirm the first real Xero sync runs at 8pm AEST (after Xero is connected)
- [ ] Call/message CCW staff the next morning to confirm dashboard shows correct data

---

_Last updated: 2026-03-30_
