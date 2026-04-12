# CCW ERP/CRM — Complete Handoff & Operations Runbook

> **For**: CCW Staff & Management
> **System**: ccwonline.com.au (Vercel) + Railway Backend + Supabase Database
> **Last updated**: 2026-03-30

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Day 0 — Initial Setup Checklist](#2-day-0--initial-setup-checklist)
3. [Connecting Your Integrations](#3-connecting-your-integrations)
4. [Understanding the Nightly Sync](#4-understanding-the-nightly-sync)
5. [Module-by-Module Operations Guide](#5-module-by-module-operations-guide)
6. [POS — Walk-In Customer Billing](#6-pos--walk-in-customer-billing)
7. [AI Features & Automation](#7-ai-features--automation)
8. [Staff Onboarding & Roles](#8-staff-onboarding--roles)
9. [Daily & Weekly Routine](#9-daily--weekly-routine)
10. [Environment Variable Reference](#10-environment-variable-reference)
11. [Troubleshooting](#11-troubleshooting)
12. [Emergency Contacts & Escalation](#12-emergency-contacts--escalation)

---

## 1. What This System Does

The CCW ERP/CRM sits **alongside** your existing Cin7, Xero, and Shopify stack. It does not replace them — it connects to them and gives you a single operational dashboard.

**What it gives you:**

- One screen to see all products, customers, orders, and stock levels
- Automatic nightly pull from Cin7 (inventory/products) and Xero (invoices/payments)
- Walk-in customer billing through the built-in POS
- Quotes, purchase orders, and supplier management
- AI-powered forecasting, anomaly detection, and auto-reorder rules
- Workshop job scheduling and equipment tracking
- KPI reports, CSV export, and invoice management

**What it does NOT do:**

- Replace Cin7 as your inventory of record (Cin7 remains master)
- Replace Xero as your accounting system (Xero remains master)
- Replace Shopify as your online store (Shopify data syncs in nightly)

---

## 2. Day 0 — Initial Setup Checklist

Complete these steps in order before going live. Tick each one off.

### 2.1 Credentials in Railway (Backend)

Log into [railway.app](https://railway.app) → open your CCW backend service → **Variables** tab.

Set the following:

**Cin7 (required for nightly product/inventory sync)**

```
CIN7_MODE=live
CIN7_CORE_ACCOUNT_ID=<your Cin7 Core account ID>
CIN7_CORE_APPLICATION_KEY=<your Cin7 Core application key>
CIN7_OMNI_USERNAME=<your Cin7 Omni username>
CIN7_OMNI_API_KEY=<your Cin7 Omni API key>
```

**Xero (required for nightly invoice/payment sync)**

```
XERO_MODE=live
XERO_CLIENT_ID=<from developer.xero.com>
XERO_CLIENT_SECRET=<from developer.xero.com>
XERO_REDIRECT_URI=https://<railway-backend-url>/api/integrations/xero/callback
```

→ See `docs/xero-setup-guide.md` for the full Xero OAuth walkthrough.

**Shopify (required for product/order sync)**

```
SHOPIFY_MODE=live
SHOPIFY_SHOP_DOMAIN=<your-store>.myshopify.com
SHOPIFY_ACCESS_TOKEN=<your Shopify Admin API token>
```

**Stripe (for invoice payment webhooks)**

```
STRIPE_SECRET_KEY=<your Stripe secret key>
STRIPE_WEBHOOK_SECRET=<from Stripe Dashboard → Webhooks>
```

**Core (already set — verify these)**

```
DATABASE_URL=<Supabase connection string>
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard>
SECRET_KEY=<random 64-char string>
ENVIRONMENT=production
```

### 2.2 Credentials in Vercel (Frontend)

Log into [vercel.com](https://vercel.com) → open your CCW project → **Settings → Environment Variables**.

Verify these are set:

```
NEXT_PUBLIC_BACKEND_URL=https://<your-railway-backend-url>
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase Dashboard>
CRON_SECRET=<same random string you used in Railway>
```

### 2.3 Connect Each Integration in the Dashboard

1. Go to **ccwonline.com.au** → log in as admin
2. Navigate to **Settings → Integrations**
3. Connect in this order:
   - **Cin7** — enter Account ID + Application Key → click "Connect" → status turns green
   - **Xero** — click "Connect Xero" → authorise in browser → returns connected
   - **Shopify** — enter store domain + access token → click "Connect"

### 2.4 Trigger the First Manual Sync

After connecting Cin7, trigger an immediate sync to import your data:

```
GET https://<backend-url>/api/cron/shadow-sync-cin7
```

(Or wait until 7pm AEST for the first automatic sync.)

---

## 3. Connecting Your Integrations

### 3.1 Cin7

**Where to find your credentials:**

1. Log into Cin7 → **Account → API**
2. Copy the **Account ID** and **Application Key** (Core API)
3. For Omni API: go to **Account → Integrations → API** → copy username + API key

**What syncs:**

- Products + SKUs + pricing + stock levels
- Customers
- Sales orders + line items
- Suppliers + purchase orders
- Inventory levels across all locations

**Sync schedule**: Every night at **7pm AEST**

### 3.2 Xero

→ See `docs/xero-setup-guide.md` for the full step-by-step.

**What syncs:**

- Invoices (paid, outstanding, overdue)
- Payments received
- Customer contacts

**Sync schedule**: Every night at **8pm AEST** (after Cin7, so invoices can reference synced orders)

> **Note**: Xero sync is currently configured but cron jobs are disabled until you connect Xero. After connecting, re-add the two Xero cron entries in `apps/web/vercel.json` — see the guide.

### 3.3 Shopify

**Where to find your credentials:**

1. Shopify Admin → **Settings → Apps and sales channels → Develop apps**
2. Create a private app → **Admin API access token**
3. Give it scopes: `read_products`, `read_orders`, `read_customers`

**What syncs:**

- Products (name, SKU, price, images)
- Orders placed online

### 3.4 Stripe

**Setting up the webhook:**

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → **Developers → Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://<backend-url>/api/webhooks/stripe`
4. Events to listen for:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `checkout.session.completed`
5. Copy the **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` in Railway

---

## 4. Understanding the Nightly Sync

The system runs a fully automated sync every night. You don't need to do anything — it runs while you sleep.

### Cron Schedule (all times AEST)

| Time        | Job                        | What it does                                               |
| ----------- | -------------------------- | ---------------------------------------------------------- |
| 5am         | Health check               | Confirms backend is alive                                  |
| 9am         | Daily report               | Updates KPI dashboard                                      |
| 9am         | Check expiring quotes      | Flags quotes due to expire                                 |
| 9am         | Customer onboarding emails | Sends Day-1/7/30 sequences                                 |
| 7pm         | **Cin7 sync**              | Pulls all products, inventory, customers, orders from Cin7 |
| 8pm         | **Xero sync**              | Pulls invoices and payments from Xero _(after Cin7)_       |
| 9pm         | **Auto-reorder**           | Creates purchase orders for items below reorder threshold  |
| Every 5min  | Webhook retry              | Retries any failed webhook deliveries                      |
| Every 15min | SLA check                  | Flags orders/tasks breaching SLA                           |
| Hourly      | Autonomous ops             | AI agent maintenance tasks                                 |
| 2am         | Cleanup                    | Removes old background job records                         |

### How to Know the Sync Ran Successfully

1. Log into the dashboard
2. Go to **Dashboard** (home page)
3. Check the **Last Sync** timestamp in the Cin7 widget
4. Check **Inventory** → product stock levels match Cin7

If the sync failed, check:

- Railway logs: your-service → **Deployments → Logs**
- Vercel logs: your-project → **Functions → Logs** → filter by `/api/cron`

---

## 5. Module-by-Module Operations Guide

### 5.1 Products

**Path**: `/products`

**What to do here:**

- View all products synced from Cin7
- Edit product names, descriptions, and categories in this system (syncs back to Cin7 on next run)
- Set reorder thresholds (triggers auto-PO when stock drops below level)
- View stock levels across all warehouse locations
- Export product list to CSV

**Best practice**: Cin7 is your master for pricing and SKUs. Edit pricing in Cin7, not here.

### 5.2 Customers

**Path**: `/customers`

**What to do here:**

- View all customers imported from Cin7
- Add notes, tags, and internal flags
- View customer order history, quotes, and invoice balances
- Check customer health score (auto-calculated from order frequency + payment history)
- View and add contacts per customer (multiple contacts per company)
- Log calls, emails, and meetings in the activity timeline

**Health scoring**: Green = healthy account, Yellow = at-risk, Red = churning. Review red accounts weekly.

### 5.3 Orders

**Path**: `/orders`

**What to do here:**

- View all sales orders (synced from Cin7 + created locally)
- Create new orders manually for phone/email customers
- Convert quotes to orders (one click)
- Generate invoices from orders
- Track order status: Draft → Confirmed → Processing → Shipped → Delivered

**Fulfilment workflow**: `/orders/fulfilment` → shows pick/pack/ship queue

### 5.4 Quotes

**Path**: `/quotes`

**What to do here:**

- Create quotes for customers
- Add line items from your product catalog
- Apply customer-specific pricing tiers
- Generate PDF quote (print view)
- Convert accepted quotes to orders
- AI quote generation: `/quotes/generate` → enter customer + product type → AI drafts the quote

**Tip**: Set an expiry date on every quote. The system will flag expiring quotes at 9am daily.

### 5.5 Invoices

**Path**: `/invoices`

**What to do here:**

- View all invoices (synced from Xero + generated locally)
- Create invoices from orders
- Record payments (cash, card, bank transfer, Stripe)
- View overdue invoices
- Export for BAS: `/invoices/bas`
- Print invoices for customers

**Payment recording**: When a customer pays via Stripe, the invoice updates automatically via the webhook. For manual payments (cash/EFT), update the invoice status in this system and in Xero.

### 5.6 Purchase Orders

**Path**: `/purchase-orders`

**What to do here:**

- View purchase orders sent to suppliers
- Create manual POs for special orders
- Record goods received (GRN workflow at `/purchase-orders/receiving`)
- Auto-POs are generated nightly by the auto-reorder cron job

### 5.7 Suppliers

**Path**: `/suppliers`

**What to do here:**

- View all suppliers (synced from Cin7)
- Add supplier contacts and notes
- View purchase order history per supplier

### 5.8 Inventory

**Path**: `/inventory`

**Sub-sections:**

| Page                      | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `/inventory`              | Stock levels across all locations        |
| `/inventory/stock`        | Stock take — count and reconcile         |
| `/inventory/transfers`    | Transfer stock between locations         |
| `/inventory/forecast`     | AI demand forecasting (next 30/90 days)  |
| `/inventory/bom`          | Bill of Materials for assembled products |
| `/inventory/reservations` | Reserved stock for confirmed orders      |

**Barcode scanning**: On the stock take page, click the barcode icon to activate the camera scanner.

### 5.9 Reports & KPIs

**Path**: `/reports`

**Available reports:**

- Revenue by month/quarter/year
- Top products by revenue
- Customer acquisition and churn
- Inventory turnover
- Gross margin analysis
- Tax/BAS summary

**Export**: Every report has a **Download CSV** button.

### 5.10 Workshop

**Path**: `/workshop`

**What to do here:**

- Schedule service jobs for equipment
- Track equipment serial numbers and warranty
- Set maintenance intervals (by date or hours)
- View the daily/weekly job schedule
- Assign jobs to staff

---

## 6. POS — Walk-In Customer Billing

**Path**: `/pos`

The POS handles all walk-in customer transactions.

### Basic Transaction Flow

1. Go to `/pos` → select your location (or default terminal)
2. Search for a product by name or scan barcode
3. Add items to the cart — quantities auto-adjust stock
4. Select customer (or create new for first-time visitors)
5. Choose payment method: Cash / Card (EFTPOS) / Account (invoice later)
6. Complete the sale → receipt prints / emails automatically
7. Stock levels update immediately in inventory

### POS Locations

**Path**: `/pos/locations`

- Set up multiple terminals (counter, warehouse, mobile)
- Each location tracks its own float and end-of-day reconciliation

### End of Day Reconciliation

**Path**: `/pos/reconciliation`

1. Count your cash drawer
2. Enter the actual amount
3. System calculates any discrepancy vs recorded cash sales
4. Print the EOD summary
5. Transfer surplus cash to safe

### Offline Mode

The POS works offline for up to 4 hours. Transactions are queued locally and sync when connectivity returns.

---

## 7. AI Features & Automation

### 7.1 Demand Forecasting

**Path**: `/inventory/forecast`

The AI analyses your Cin7 sales history to predict stock requirements for the next 30, 60, and 90 days. Updated nightly.

**How to use it**: If a product shows "risk of stockout in 12 days", place a purchase order now.

### 7.2 Auto-Reorder

Set reorder thresholds on products (`/products` → edit a product → "Reorder point" field).

The 9pm cron job automatically generates a Purchase Order draft when any product drops below its reorder point. You receive an alert and review the draft PO before it's sent to the supplier.

### 7.3 Quote AI Generation

**Path**: `/quotes/generate`

Enter a customer name and what they're looking to buy. The AI drafts a quote with products from your catalog and suggested quantities based on their order history.

### 7.4 AI Assistant (Staff Copilot)

**Path**: `/ai-assistant`

Ask plain-English questions about your business:

- "Which customers haven't ordered in 90 days?"
- "What's my stock level for SKU CCW-1234?"
- "Generate a quote for Acme Corp for 10 angle grinders"
- "Show me all overdue invoices over $500"

### 7.5 Anomaly Detection

The system automatically flags:

- Unusual order volumes (sudden spike or drop)
- Pricing anomalies (order at the wrong price)
- Stock discrepancies between Cin7 and local records

Alerts appear in the **Alerts** section (`/alerts`) and in the notification bell.

---

## 8. Staff Onboarding & Roles

### Creating Staff Accounts

1. Go to **Settings → Team** (`/settings/team`)
2. Click **Invite User**
3. Enter their email address and role
4. They receive an email with a login link
5. They set their own password on first login

**Note**: Accounts are created by admins only. Staff cannot self-register.

### Roles & Access

| Role      | Access                                               |
| --------- | ---------------------------------------------------- |
| Admin     | Full access — all modules, settings, user management |
| Manager   | All modules except user management and settings      |
| Sales     | Customers, Quotes, Orders, Invoices, POS             |
| Warehouse | Inventory, Purchase Orders, Receiving, Suppliers     |
| Workshop  | Workshop module only                                 |

### Removing Staff

Settings → Team → find the user → **Deactivate**. Their data is preserved but they can no longer log in.

---

## 9. Daily & Weekly Routine

### Every Morning (5–10 minutes)

- [ ] Check **Dashboard** — review today's KPIs and any overnight alerts
- [ ] Check **Alerts** (`/alerts`) — resolve any flagged items
- [ ] Review any auto-generated Purchase Order drafts from the overnight reorder run
- [ ] Check the **Workshop schedule** if your team does field service

### Every Week

- [ ] Review **Customer Health** (`/customers/health`) — contact any red-score accounts
- [ ] Review **Overdue Invoices** — chase any accounts 7+ days overdue
- [ ] Check **Expiring Quotes** — follow up with prospects
- [ ] Review **Inventory Forecast** — confirm stock covers next 4 weeks

### Every Month

- [ ] Export revenue report for the month
- [ ] Run BAS report: `/invoices/bas`
- [ ] Review auto-reorder rules — adjust thresholds for seasonal demand changes
- [ ] Check sync logs to confirm all nightly runs succeeded

---

## 10. Environment Variable Reference

### Railway (Backend) — Full List

```bash
# Core
ENVIRONMENT=production
SECRET_KEY=<64-char random string>
DATABASE_URL=<Supabase PostgreSQL connection string>
SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard>

# Cin7
CIN7_MODE=live
CIN7_CORE_ACCOUNT_ID=<account ID>
CIN7_CORE_APPLICATION_KEY=<application key>
CIN7_OMNI_USERNAME=<username>
CIN7_OMNI_API_KEY=<API key>

# Xero
XERO_MODE=live
XERO_CLIENT_ID=<client ID from developer.xero.com>
XERO_CLIENT_SECRET=<client secret>
XERO_REDIRECT_URI=https://<backend-url>/api/integrations/xero/callback

# Shopify
SHOPIFY_MODE=live
SHOPIFY_SHOP_DOMAIN=ccwonline.myshopify.com
SHOPIFY_ACCESS_TOKEN=<admin API token>

# Stripe
STRIPE_SECRET_KEY=<sk_live_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>

# Redis (if using Railway Redis add-on)
REDIS_URL=<Redis connection URL>
```

### Vercel (Frontend) — Full List

```bash
NEXT_PUBLIC_BACKEND_URL=https://<railway-backend-url>
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase Dashboard>
NEXT_PUBLIC_FRONTEND_URL=https://ccwonline.com.au
CRON_SECRET=<same secret as Railway CRON_SECRET>
```

---

## 11. Troubleshooting

### Nightly Sync Didn't Run

1. Check Vercel Logs → Functions → filter by `/api/cron`
2. Check if `CRON_SECRET` matches between Vercel and Railway
3. Check Railway backend logs for Python errors
4. Manually trigger: `GET https://<backend-url>/api/cron/shadow-sync-cin7`

### Products Not Showing Up

1. Was the Cin7 sync successful? (Check Dashboard widget)
2. Is Cin7 in demo mode? Check: `CIN7_MODE=live` in Railway
3. Does the Cin7 API key have read access to products?

### Xero Not Connecting

→ See `docs/xero-setup-guide.md` → Troubleshooting section

### POS Not Loading

1. Check if the backend is healthy: `GET https://<backend-url>/health`
2. Clear browser cache and reload
3. If offline: check the orange "Offline" banner — transactions still work, they'll sync later

### "Prometheus not configured" on Monitoring page

This is expected if you're not running Prometheus. The monitoring page (`/monitoring`) shows system metrics if Prometheus is set up. For the MVP, ignore this page.

### Staff Can't Log In

1. Admin: go to Settings → Team → check their account is **Active**
2. Have them use "Forgot Password" on the login page
3. If Supabase auth is down: check [status.supabase.com](https://status.supabase.com)

---

## 12. Emergency Contacts & Escalation

| Issue                         | First contact                                      | Escalate to |
| ----------------------------- | -------------------------------------------------- | ----------- |
| App not loading (Vercel down) | [vercel.com/status](https://vercel.com/status)     | Phill       |
| Backend errors (Railway down) | [railway.app/status](https://railway.app/status)   | Phill       |
| Database issues (Supabase)    | [status.supabase.com](https://status.supabase.com) | Phill       |
| Cin7 API errors               | Cin7 support                                       | Phill       |
| Xero API errors               | Xero support                                       | Phill       |
| Shopify API errors            | Shopify support                                    | Phill       |
| Feature requests or bugs      | Log in Linear (Unite-Group / CCW-ERP)              | Phill       |

---

_This document is maintained by the development team. For the latest version, see `docs/ccw-handoff-runbook.md` in the CCW-CRM repository._
