# Production Smoke Test — 15-Point Checklist

**Version**: 1.0
**Run after each deployment**

---

## Pre-Flight

- [ ] Backend health: `GET https://[railway-url]/health` → `{"status": "healthy"}`
- [ ] Frontend loads: `https://ccwonline.com.au` → homepage visible, no 500 errors

---

## Authentication

- [ ] Login works: Go to `/login` → enter `admin@demo.com` / `demo123` → redirected to `/dashboard`
- [ ] Dashboard loads: KPI cards visible (Revenue, Orders, Stock Alerts, Pending Quotes)

---

## Core CRUD

- [ ] **Products**: `/products` → list loads → click row → edit → save
- [ ] **Customers**: `/customers` → list loads → create new customer → save
- [ ] **Orders**: `/orders` → create new order → add line items → confirm
- [ ] **Quotes**: `/quotes` → create quote → add products → send

---

## POS

- [ ] `/pos` → search product → add to cart → select payment method → complete sale → receipt shown

---

## Integrations

- [ ] `/settings/integrations` → Cin7 card shows connection status
- [ ] Dashboard sync widget: last sync timestamp is recent (within 24h)

---

## Navigation & Layout

- [ ] Sidebar all links work (no 404s): Dashboard, Products, Customers, Orders, Quotes, POS, Inventory, Invoices, Workshop, Reports, Settings
- [ ] Mobile viewport (375px width): sidebar collapses, content readable

---

## Data Export

- [ ] Products list → Export CSV → file downloads with correct columns

---

## Cron Jobs

- [ ] Vercel Dashboard → Cron Jobs tab → last execution of `shadow-sync-cin7` is within 24h with status "Success"

---

## Result

| Check | Status | Notes |
|---|---|---|
| Backend health | | |
| Frontend loads | | |
| Login | | |
| Dashboard | | |
| Products CRUD | | |
| Customers CRUD | | |
| Orders CRUD | | |
| Quotes CRUD | | |
| POS | | |
| Integrations | | |
| Navigation | | |
| Mobile | | |
| CSV Export | | |
| Cron Jobs | | |

**Overall**: ✅ PASS / ❌ FAIL

**Tested by**: _______________  **Date**: _______________
