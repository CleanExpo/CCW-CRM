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
Test each endpoint directly (requires `CRON_SECRET` header):

```bash
curl -H "x-cron-secret: <CRON_SECRET>" https://ccwonline.com.au/api/cron/health-check
curl -H "x-cron-secret: <CRON_SECRET>" https://ccwonline.com.au/api/cron/shadow-sync-cin7
curl -H "x-cron-secret: <CRON_SECRET>" https://ccwonline.com.au/api/cron/auto-reorder-inventory
curl -H "x-cron-secret: <CRON_SECRET>" https://ccwonline.com.au/api/cron/daily-report
```

- [ ] health-check → `{"status": "ok"}`
- [ ] shadow-sync-cin7 → `{"status": "success"}` or `{"status": "demo"}`
- [ ] auto-reorder-inventory → `{"status": "success"}`
- [ ] daily-report → `{"status": "success"}`

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

*Last updated: 2026-03-30*
