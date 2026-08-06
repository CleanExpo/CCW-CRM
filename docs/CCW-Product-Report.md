# CCW Online — ERP/CRM Product Report

**Prepared for**: CCW Equipment Supplies
**Prepared by**: Unite Group Development
**Date**: 30 March 2026
**Version**: 1.0
**System URL**: https://ccwonline.com.au

---

> ## ⚠️ CORRECTION NOTICE — 2026-08-07 — DO NOT REISSUE AS-IS
>
> This report was written on 30 March 2026 and parts of it no longer describe the system that
> exists. It is retained for history. The accurate current position is `docs/PROJECT-STATUS.md`,
> where every figure carries the command that produced it.
>
> Known-wrong statements in the pages below:
>
> 1. **"823 automated tests all passing."** Measured 2026-08-07: **377 passing, 2 skipped.**
> 2. **The Railway backend does not exist.** §2 diagrams a Vercel frontend plus a Railway FastAPI
>    backend, and §5.1–5.5 instruct CCW staff to enter Cin7, Xero and Shopify credentials into
>    Railway. There is no Railway tier in this product. Following those instructions configures
>    nothing. Credentials belong on the Vercel project.
> 3. **The cron table in §12 lists eight endpoints that have been removed** for returning HTTP 501
>    on every scheduled run: `retry-failed-webhooks`, `run-autonomous-ops`, `refresh-health-scores`,
>    `check-expiring-quotes`, `process-onboarding-emails`, `shadow-sync-cin7`, `shadow-sync-xero`,
>    `auto-reorder-inventory`. The nightly Cin7 sync described as running at 7:00pm did not run. The
>    sync that does work is `nightly-full-sync` at 9:00pm AEST.
> 4. **Auto-reorder (automatic draft purchase orders for low-stock items) is not built.** The
>    endpoint that claimed to do it returned 501.
>
> **The system is additionally not usable at the time of writing**: the production deployment has no
> database connection configured, so login returns HTTP 503. See §0 of `docs/PROJECT-STATUS.md`.
>
> A corrected edition should be issued to CCW once the deployment is restored. Reissuing is
> customer-facing and needs the owner's sign-off.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Module Guide](#3-module-guide)
   - 3.1 Core Operations
   - 3.2 CRM
   - 3.3 Inventory & Warehouse
   - 3.4 Finance
   - 3.5 AI & Analytics
   - 3.6 Workshop
   - 3.7 Portals
   - 3.8 Admin & Settings
4. [Integration Status](#4-integration-status)
5. [Remaining Setup Required by CCW](#5-remaining-setup-required-by-ccw)
6. [Nightly Sync Pipeline](#6-nightly-sync-pipeline)
7. [Security & Access Control](#7-security--access-control)
8. [Training Guide](#8-training-guide)
9. [Export & Reporting](#9-export--reporting)
10. [Troubleshooting](#10-troubleshooting)
11. [Technical Appendix](#11-technical-appendix)
12. [Go-Live Checklist](#12-go-live-checklist)

---

## 1. Executive Summary

CCW Online is a cloud-based ERP/CRM system purpose-built to sit alongside CCW Equipment Supplies' existing technology stack — Cin7 (inventory), Xero (accounting), and Shopify (ecommerce). Rather than replacing these tools, CCW Online syncs data from them every night and presents everything through a single, unified dashboard at ccwonline.com.au. Staff across operations, sales, inventory, finance, and management can access the information they need without switching between multiple applications. The system currently comprises over 80 pages, 679+ API endpoints, and 377 automated tests passing with 2 skipped (corrected 2026-08-07; this sentence previously claimed 823), covering every business function from point-of-sale transactions to AI-powered demand forecasting.

The system is fully deployed and operational. The frontend runs on Vercel (a globally distributed hosting platform), the backend runs on Railway (a managed server platform), and the database is hosted on Supabase (enterprise-grade PostgreSQL with built-in authentication). All core modules are functional and loaded with demonstration data so that staff can explore every feature before going live. The system is ready to receive live data as soon as CCW connects its integrations.

To go live, CCW needs to complete five integration connections: Cin7, Xero, Shopify, Stripe, and SendGrid. Each integration has a setup card in the system at Settings > Integrations. Once credentials are entered and connections verified, the nightly sync will begin pulling real data into the dashboard. Staff should then complete the training outlined in Section 8 of this document before commencing daily use.

---

## 2. System Architecture

The system follows a three-tier architecture where CCW staff interact with the frontend, which communicates with the backend, which in turn connects to the database and external services.

```
CCW Staff (Browser) --> ccwonline.com.au (Vercel/Next.js)
                              |
                       Railway (FastAPI Backend)
                              |
                       Supabase (PostgreSQL + Auth)
                              |
              +---------------+---------------+
           Cin7 API       Xero API       Shopify API
        (inventory)     (accounting)    (ecommerce)
```

Data synchronisation runs automatically every night via scheduled jobs. At 7:00pm AEST, the Cin7 sync pulls products, inventory levels, customers, and orders into CCW Online. At 8:00pm AEST, the Xero sync pulls invoices and payments (once the OAuth connection is established). At 9:00pm AEST, the auto-reorder engine runs, generating draft purchase orders for any products that have fallen below their reorder threshold. The following morning at 9:00am AEST, the daily KPI report refreshes to reflect the latest data across all dashboards.

The system also provides real-time features through Server-Sent Events (SSE) — a technology that pushes live updates to the browser without requiring a page refresh. This powers the dashboard's live metrics, inventory change notifications, and POS failure alerts, so staff always see the most current information without manually refreshing.

---

## 3. Module Guide

### 3.1 Core Operations

### Dashboard

**URL**: `/dashboard`
**Purpose**: Central command centre showing all key business metrics at a glance.

**Key Features**:

- 11 KPI widgets covering revenue, orders, products, customers, stock alerts, pending quotes, and AI-generated insights
- Real-time SSE streams for POS failure alerts and live metric updates
- Cin7 sync status widget showing the last successful sync timestamp
- Revenue chart and category sales chart for trend analysis
- Stock health summary with transfer suggestions
- Order status breakdown and quote conversion rates
- Revenue by location (Brisbane, Sydney, Melbourne)

**Staff Training Note**: This is your starting point each morning — check the KPI cards and stock alerts before doing anything else.

---

### Orders

**URL**: `/orders`
**Purpose**: Manage the full lifecycle of customer orders from creation through to delivery.

**Key Features**:

- Full create, read, update, and delete (CRUD) operations
- Status workflow: Draft > Pending > Confirmed > Processing > Shipped > Delivered > Cancelled
- Line item management with product search
- Bulk delete for clearing test or draft orders
- CSV and PDF export for record-keeping
- Create invoice directly from an order with one click
- Search by order number or filter by status
- Fulfilment tracking at `/orders/fulfilment`

**Staff Training Note**: Always update order status as it progresses — the warehouse team relies on status changes to know what to pick and pack.

---

### Quotes

**URL**: `/quotes`
**Purpose**: Create and manage customer quotations, then convert accepted quotes to orders.

**Key Features**:

- Full CRUD operations with status tracking
- Line item management with product search and pricing
- Convert accepted quotes to orders with one click
- AI Quote Copilot chat for assistance drafting quotes
- CSV and PDF export
- Expiry date tracking with automated alerts for quotes nearing expiry

**Staff Training Note**: Set expiry dates on every quote (14 or 30 days) — the system will alert you when quotes are about to expire so you can follow up.

---

### Purchase Orders

**URL**: `/purchase-orders`
**Purpose**: Create and track orders placed with your suppliers, and receive goods when they arrive.

**Key Features**:

- Full CRUD operations with supplier selection
- Goods Receipt Note (GRN) receiving at `/purchase-orders/receiving` for recording what actually arrived
- Auto-generated draft POs from the overnight reorder engine for products below their reorder threshold
- Status tracking through the purchase order lifecycle
- Delivery location selection (Brisbane, Sydney, Melbourne)

**Staff Training Note**: Check for auto-generated draft POs each morning — review and approve them or adjust quantities before sending to suppliers.

---

### POS

**URL**: `/pos`
**Purpose**: Point-of-sale terminal for processing walk-in sales at any CCW location.

**Key Features**:

- Product search by name, SKU, or barcode scanner
- Cart management with quantity adjustment
- Payment method selection: Cash, Card, EFTPOS, or Account
- Receipt printing and email receipts
- Automatic stock level deduction after each sale
- Reconciliation at `/pos/reconciliation` for end-of-day cash-up
- Staff management at `/pos/staff`
- Location management at `/pos/locations`

**Staff Training Note**: Always run the End of Day reconciliation before closing — this ensures your cash drawer balances and all sales are properly recorded.

---

### 3.2 CRM

### Customers

**URL**: `/customers`
**Purpose**: Maintain a complete view of every customer, their history, and their health score.

**Key Features**:

- Full CRUD with company and contact information
- Order history and activity timeline per customer
- Notes for recording interactions and follow-ups
- CSV export for mailing lists or external analysis
- Customer health scoring at `/customers/health` to identify at-risk accounts
- Onboarding tracking at `/customers/onboarding` for new customers
- Customer personas at `/customers/personas` for segmentation
- Detailed customer page at `/customers/[id]` with tabs for profile, orders, quotes, and activities

**Staff Training Note**: Review the Health Scoring page weekly to catch customers whose engagement is dropping before they churn.

---

### Contacts

**URL**: `/contacts`
**Purpose**: Manage multiple contacts per customer organisation.

**Key Features**:

- Multiple contacts per customer with role and department information
- Full CRUD with search
- CSV export
- Detail page for individual contact records

**Staff Training Note**: Keep contact details current — when someone changes role or leaves a customer organisation, update the record so emails reach the right person.

---

### Contractors

**URL**: `/contractors`
**Purpose**: Manage labour and service contractors who perform work for CCW.

**Key Features**:

- Contractor profile management
- Service history tracking

**Staff Training Note**: Add all active contractors to the system so that workshop jobs can be assigned to the correct person.

---

### Service Requests

**URL**: `/service-requests`
**Purpose**: Track customer service and repair requests through their full lifecycle.

**Key Features**:

- Status workflow: Submitted > Under Review > Quote Sent > Approved > Scheduled > In Progress > Completed > Cancelled
- Linked to customer records
- Full request detail tracking

**Staff Training Note**: Update the status at each stage so customers can see progress if they check the portal.

---

### Activities

**URL**: `/activities`
**Purpose**: Log all customer interactions and internal tasks with SLA tracking.

**Key Features**:

- Activity types: Phone, Email, Meeting, Note, Task
- SLA tracking to ensure follow-ups happen on time
- Status tracking: Pending or Completed
- Linked to customer records

**Staff Training Note**: Log every customer interaction (even a quick phone call) so the whole team can see the communication history.

---

### 3.3 Inventory & Warehouse

### Inventory Overview

**URL**: `/inventory`
**Purpose**: View stock levels across all locations and make adjustments or transfers.

**Key Features**:

- Multi-location stock view (Brisbane, Sydney, Melbourne)
- Barcode scanner support for quick product lookup
- Stock transfer dialog for moving stock between locations
- Stock adjustment dialog for corrections after stocktakes
- Reorder point settings per product
- Real-time SSE updates — stock changes appear instantly without refreshing

**Staff Training Note**: Products are colour-coded — Red means critical (nearly out), Orange means low (approaching reorder point), Green means healthy.

---

### Products

**URL**: `/products`
**Purpose**: Browse and manage the full product catalogue with live Cin7 stock data.

**Key Features**:

- Full catalogue CRUD operations
- 8 equipment categories for organisation
- Real-time stock levels synced from Cin7
- Multi-location stock display (Brisbane, Sydney, Melbourne)
- CSV export for catalogue reports
- Product detail page with full specifications

**Staff Training Note**: Product stock levels update automatically from Cin7 each night — manual edits here will be overwritten by the next sync unless you also update Cin7.

---

### Stock List

**URL**: `/inventory/stock`
**Purpose**: Detailed inventory listing by product and location.

**Key Features**:

- Comprehensive stock view by product and location
- Low stock highlighting for quick identification
- Barcode scanner support

**Staff Training Note**: Use this page for stocktakes — it shows every product at every location with current counts.

---

### Stock Transfers

**URL**: `/inventory/transfers`
**Purpose**: Move stock between CCW locations.

**Key Features**:

- Inter-location transfer creation and tracking
- Status tracking: Pending > In Transit > Received > Cancelled
- Full audit trail of transfer history

**Staff Training Note**: When sending stock to another branch, create the transfer here so both locations can track it.

---

### Reservations

**URL**: `/inventory/reservations`
**Purpose**: Hold stock for confirmed orders so it cannot be sold to someone else.

**Key Features**:

- Order-based stock reservation management
- Visibility into what stock is reserved versus available

**Staff Training Note**: Reserved stock is excluded from available-to-sell counts, preventing overselling.

---

### Stock Forecast

**URL**: `/inventory/forecast`
**Purpose**: AI-powered demand forecasting to predict what you will need and when.

**Key Features**:

- 30-day, 60-day, and 90-day demand forecasting
- AI-generated reorder recommendations
- CSV export for sharing forecasts with suppliers

**Staff Training Note**: Check the 30-day forecast weekly to stay ahead of demand — especially before peak seasons.

---

### Bill of Materials

**URL**: `/inventory/bom`
**Purpose**: Manage assembled products and their component parts.

**Key Features**:

- Cin7 BOM management integration
- Production run tracking to monitor assembly progress
- Component stock level visibility

**Staff Training Note**: Before starting a production run, check that all component stock levels are sufficient.

---

### Warehouse

**URL**: `/warehouse`
**Purpose**: Centralised warehouse management with AI-assisted operations.

**Key Features**:

- Tabs for stock, transfers, and adjustments
- AI-suggested stock adjustments based on patterns
- Equipment management

**Staff Training Note**: Review AI-suggested adjustments after each stocktake to catch discrepancies the system has detected.

---

### Containers

**URL**: `/containers`
**Purpose**: Track inbound shipments and shipping containers.

**Key Features**:

- Shipment and container tracking with vessel information
- Estimated versus actual arrival date comparison
- Warehouse assignment for incoming goods

**Staff Training Note**: Update actual arrival dates when containers dock so the team knows when to expect goods for receiving.

---

### Backorders

**URL**: `/backorders`
**Purpose**: Track orders that cannot be fulfilled due to insufficient stock.

**Key Features**:

- Backorder tracking with fulfilment progress
- Email alerts when backordered stock becomes available

**Staff Training Note**: Check backorders when new stock arrives — fulfil these before processing new orders for the same products.

---

### 3.4 Finance

### Invoices

**URL**: `/invoices`
**Purpose**: Create, send, and track invoices through to payment, with BAS reporting for GST compliance.

**Key Features**:

- Full CRUD with status tracking: Draft > Sent > Partially Paid > Paid > Overdue > Written Off > Cancelled
- Payment recording with method, reference, and date
- Print view for professional invoice output
- Financial report tab with KPIs: total invoiced, outstanding, overdue, and collection rate
- CSV export for accounting records
- BAS Report at `/invoices/bas` for Australian GST compliance — export quarterly for your accountant

**Staff Training Note**: Check the Overdue filter daily and follow up promptly — the longer an invoice is overdue, the harder it is to collect.

---

### Bank Feeds

**URL**: `/bank-feeds`
**Purpose**: Import and reconcile bank transactions against invoices and payments.

**Key Features**:

- Bank transaction import from multiple accounts
- Reconciliation matching against recorded invoices
- Trending indicators showing cash flow patterns

**Staff Training Note**: Reconcile bank feeds weekly to keep your books accurate and catch any missing payments.

---

### Suppliers

**URL**: `/suppliers`
**Purpose**: Manage supplier contact information and payment terms.

**Key Features**:

- Full CRUD with contact details
- Payment terms and ABN recording
- CSV export for supplier directory

**Staff Training Note**: Keep payment terms up to date — purchase orders use these to calculate expected payment dates.

---

### 3.5 AI & Analytics

### AI Assistant

**URL**: `/ai-assistant`
**Purpose**: Ask questions about your business data in plain English and get instant answers.

**Key Features**:

- Chat interface for natural language data queries
- Multi-turn conversations for follow-up questions
- Responses formatted in readable markdown with tables and charts

**Staff Training Note**: Try asking questions like "What were our top 10 products by revenue last month?" or "Which customers haven't ordered in 60 days?"

---

### AI Query

**URL**: `/ai-query`
**Purpose**: Ask data questions in plain English and get structured table results.

**Key Features**:

- Natural language to database query translation
- Results displayed as data tables
- No technical knowledge required

**Staff Training Note**: This is similar to the AI Assistant but returns structured table data — useful when you need exact numbers to paste into a spreadsheet.

---

### AI Ops Centre

**URL**: `/ai-ops`
**Purpose**: Monitor and control autonomous AI agent actions across the system.

**Key Features**:

- View all AI-initiated actions with confidence scoring
- Approve or reject AI recommendations before they take effect
- Full audit trail of AI decisions

**Staff Training Note**: Review the Ops Centre periodically to ensure AI recommendations align with your business judgment.

---

### Insights

**URL**: `/insights`
**Purpose**: AI-generated business insights surfaced automatically from your data.

**Key Features**:

- AI-generated insights across sales, inventory, customers, and operations
- Category filtering to focus on specific areas
- Priority levels to highlight the most impactful findings

**Staff Training Note**: Check Insights weekly for trends you might have missed — the AI analyses patterns across all your data.

---

### Reports

**URL**: `/reports`
**Purpose**: Pre-built dashboards for sales performance and inventory health.

**Key Features**:

- Sales KPI dashboard: revenue trends, order volume, average order value, top customers
- Inventory Health dashboard: stock value, turnover rate, slow-moving items, stock coverage days

**Staff Training Note**: Use the Sales dashboard for weekly team meetings and the Inventory Health dashboard for monthly stock reviews.

---

### Marketing

**URL**: `/marketing`
**Purpose**: AI-powered marketing campaign tools.

**Key Features**:

- AI campaign generation from business objectives
- Asset library for marketing materials
- Landing page headline suggestions

**Staff Training Note**: Use the campaign generator when planning promotions — it suggests messaging based on your customer and product data.

---

### PRD Generator

**URL**: `/prd/generate`
**Purpose**: AI-powered Product Requirements Document creation for new product lines or features.

**Key Features**:

- Structured document generation from brief descriptions
- Industry-standard PRD format output

**Staff Training Note**: Use this when scoping new equipment lines or service offerings — it creates a structured brief you can share with the team.

---

### 3.6 Workshop

### Workshop Dashboard

**URL**: `/workshop`
**Purpose**: Overview of all workshop service jobs across locations.

**Key Features**:

- Location filtering: Brisbane, Sydney, Melbourne
- Job counts by status: Scheduled, Confirmed, In Progress, Completed

**Staff Training Note**: Check the dashboard first thing each morning to see what jobs are due today at your location.

---

### Equipment

**URL**: `/workshop/equipment`
**Purpose**: Track equipment brought in for service.

**Key Features**:

- Equipment listing with service status
- Overdue service detection and highlighting
- Detail page for full equipment history

**Staff Training Note**: Equipment flagged as overdue needs immediate attention — contact the customer to arrange service.

---

### Schedule

**URL**: `/workshop/schedule`
**Purpose**: Calendar view for planning and managing service appointments.

**Key Features**:

- Calendar interface for scheduling jobs
- Drag and drop for rescheduling

**Staff Training Note**: Keep the schedule current so the workshop team knows exactly what is coming each day.

---

### Templates

**URL**: `/workshop/templates`
**Purpose**: Create reusable templates for common service jobs.

**Key Features**:

- Template creation for recurring job types
- Standardised job descriptions and checklists

**Staff Training Note**: Set up templates for your most common service types to save time when creating new jobs.

---

### Reminders

**URL**: `/workshop/reminders`
**Purpose**: Automated service reminder notifications.

**Key Features**:

- Service reminder scheduling
- Notification management

**Staff Training Note**: Configure reminders for annual servicing so customers are contacted automatically when their equipment is due.

---

### 3.7 Portals

### Customer Portal

**URL**: `/portal`
**Purpose**: Self-service portal for customers to view their orders, invoices, and service requests.

**Key Features**:

- Customer login with self-service access
- Order list and order tracking
- Invoice list and payment history
- Certification tracking
- Service request submission and status checking

**Staff Training Note**: Direct customers to the portal when they call asking about order status — it reduces phone call volume and gives them 24/7 access.

---

### Supplier Portal

**URL**: `/supplier`
**Purpose**: Self-service portal for suppliers to manage purchase orders and deliveries.

**Key Features**:

- Purchase order viewing
- Delivery tracking and updates
- Invoice submission by suppliers

**Staff Training Note**: Encourage suppliers to use the portal to submit invoices and update delivery dates — it keeps everything in one place.

---

### Guest Order View

**URL**: `/order/[token]`
**Purpose**: Public shareable link for customers to track a specific order without logging in.

**Key Features**:

- Token-based access (no login required)
- Order status and tracking information

**Staff Training Note**: Share the guest tracking link with customers who do not have portal accounts — it is included in order confirmation emails.

---

### 3.8 Admin & Settings

### Workflows

**URL**: `/workflows`
**Purpose**: Automate business processes with trigger-based workflows.

**Key Features**:

- Business process automation with configurable triggers
- Template creation for common workflows
- Trigger activation and deactivation

**Staff Training Note**: Workflows run automatically once activated — test with a single record before enabling for all data.

---

### Approvals

**URL**: `/approvals`
**Purpose**: Manage approval chains for purchases, discounts, or other business decisions.

**Key Features**:

- Approval chain management with multi-level sign-off
- Approve or reject with notes
- Full approval history

**Staff Training Note**: Check your pending approvals daily — delayed approvals hold up orders and purchase orders.

---

### Alerts

**URL**: `/alerts`
**Purpose**: System and business alerts requiring attention.

**Key Features**:

- Alerts by type: Inventory, Order, Customer, System
- Severity levels: Critical (red), Warning (yellow), Info (blue)
- Dismiss or resolve alerts

**Staff Training Note**: Critical alerts (red) need same-day action — these indicate stock-outs, failed syncs, or overdue items.

---

### Monitoring

**URL**: `/monitoring`
**Purpose**: System health and performance monitoring.

**Key Features**:

- System health tab showing uptime and response times
- API performance metrics
- Business metrics summary

**Staff Training Note**: If the system feels slow, check the Monitoring page — it will show if there is a backend issue or if it is a local network problem.

---

### Emails

**URL**: `/emails`
**Purpose**: Email management with intelligent classification.

**Key Features**:

- Email management and history
- Intent classification (order enquiry, complaint, quote request, etc.)
- SendGrid integration for delivery tracking

**Staff Training Note**: The system classifies incoming emails by intent — use this to prioritise responses and route to the right team member.

---

### Settings — Account

**URL**: `/settings/account`
**Purpose**: Manage your personal profile and preferences.

**Key Features**:

- Profile information update
- Password change
- Notification preferences

**Staff Training Note**: Set your notification preferences when you first log in so you receive alerts relevant to your role.

---

### Settings — Company

**URL**: `/settings/company`
**Purpose**: Organisation-wide configuration.

**Key Features**:

- Company name, ABN, and address
- Default settings for invoices and orders

**Staff Training Note**: This should be configured once during setup — changes here affect all documents and reports.

---

### Settings — Team

**URL**: `/settings/team`
**Purpose**: Manage staff accounts and access levels.

**Key Features**:

- Create and manage staff user accounts
- Assign roles (Owner, Admin, Member, Billing)
- Deactivate accounts for departed staff

**Staff Training Note**: Remove access immediately when someone leaves the company — do not wait until the end of the pay period.

---

### Settings — Integrations

**URL**: `/settings/integrations`
**Purpose**: Connect and manage external service integrations.

**Key Features**:

- Connection cards for Cin7, Xero, Shopify, SendGrid, and AP2
- Sync controls and manual sync triggers
- Connection status indicators

**Staff Training Note**: This is where you connect your live systems — see Section 5 for step-by-step instructions for each integration.

---

### Settings — Translations

**URL**: `/settings/translations`
**Purpose**: Multi-language support for the interface.

**Key Features**:

- Support for 10 languages
- Translation management for labels and messages

**Staff Training Note**: English is the default — only configure translations if you have staff who prefer a different language.

---

## 4. Integration Status

| Integration | Current Status                     | What It Syncs                                          | Sync Frequency             | CCW Action Required                                    |
| ----------- | ---------------------------------- | ------------------------------------------------------ | -------------------------- | ------------------------------------------------------ |
| Cin7        | Demo mode — ready for live         | Products, inventory, customers, orders, suppliers, POs | Nightly @ 7pm AEST         | Enter API credentials in Railway, set CIN7_MODE=live   |
| Xero        | Pending — OAuth not yet configured | Invoices, payments, contacts                           | Nightly @ 8pm AEST         | Create Xero Dev App, complete OAuth flow via dashboard |
| Shopify     | Pending — needs access token       | Products, orders, inventory                            | Webhook-driven (real-time) | Create custom app in Shopify admin, enter access token |
| Stripe      | Webhook receiver ready             | Payment events (invoice.paid, payment_failed)          | Real-time webhooks         | Set STRIPE_WEBHOOK_SECRET in Railway                   |
| SendGrid    | Pending — needs API key            | Transactional email (orders, quotes, invoices)         | Event-triggered            | Enter SendGrid API key in Railway                      |

### Nightly Sync Pipeline

```
7:00pm AEST  -->  Cin7 sync     -->  products, inventory, customers, orders
8:00pm AEST  -->  Xero sync     -->  invoices, payments (after OAuth setup)
9:00pm AEST  -->  Auto-reorder  -->  draft POs for products below reorder threshold
9:00am AEST  -->  Daily report  -->  KPI dashboard refresh
```

---

## 5. Remaining Setup Required by CCW

### 5.1 Connecting Cin7 (15 minutes)

1. Log in to Cin7 at inventory.dearsystems.com
2. Go to Settings, then API. Copy your Account ID and Application Key.
3. In the Railway dashboard, open the backend service, then Variables. Add the following three variables:
   - `CIN7_MODE` = `live`
   - `CIN7_CORE_ACCOUNT_ID` = (paste your Account ID)
   - `CIN7_CORE_APPLICATION_KEY` = (paste your Application Key)
4. In the CCW Online dashboard, go to Settings > Integrations > Cin7 card. Enter the credentials and click Save & Connect.
5. To verify: The Cin7 card should now show "Connected". Click "Sync Now" to trigger a manual sync, then check the Products page to confirm real product data appears.

### 5.2 Connecting Xero (30 minutes)

1. Go to developer.xero.com and sign in with the CCW Xero account.
2. Click My Apps, then New App. Set the name to "CCW ERP Integration". Set the redirect URI to your Railway backend URL followed by `/api/integrations/xero/callback`.
3. Copy the Client ID. Generate a Client Secret and copy it as well.
4. In the Railway dashboard, open the backend service, then Variables. Add the following four variables:
   - `XERO_MODE` = `live`
   - `XERO_CLIENT_ID` = (paste your Client ID)
   - `XERO_CLIENT_SECRET` = (paste your Client Secret)
   - `XERO_REDIRECT_URI` = (paste the same redirect URI from step 2)
5. In the Vercel project settings, re-enable the two Xero cron entries that are currently commented out: the Xero token refresh (every 15 minutes) and the Xero shadow sync (8pm daily).
6. In the CCW Online dashboard, go to Settings > Integrations > Xero card. Click "Connect to Xero". A Xero window will open — authorise the connection.
7. To verify: The Xero card should now show your organisation name and "Connected". After 8pm, check the Invoices page for synced data.

### 5.3 Connecting Shopify (20 minutes)

1. In your Shopify admin panel, go to Settings > Apps and sales channels > Develop apps > Create app. Name it "CCW ERP Integration".
2. Configure the Admin API scopes. You need: read_orders, write_orders, read_products, write_products, read_inventory, write_inventory, read_locations.
3. Install the app, then copy the Admin API access token.
4. In the Railway dashboard, open the backend service, then Variables. Add the following three variables:
   - `SHOPIFY_MODE` = `live`
   - `SHOPIFY_SHOP_DOMAIN` = (your Shopify domain, e.g. ccw-equipment.myshopify.com)
   - `SHOPIFY_ACCESS_TOKEN` = (paste your access token)
5. In the CCW Online dashboard, go to Settings > Integrations > Shopify card. Enter the domain and access token, then click Connect.
6. To verify: The Shopify card should show "Connected". Place a test order in Shopify and confirm it appears on the Orders page in CCW Online.

### 5.4 Activating Stripe Webhooks (10 minutes)

1. In the Stripe dashboard, go to Developers > Webhooks > Add endpoint.
2. Set the URL to your Railway backend URL followed by `/api/webhooks/stripe`.
3. Select these events to listen for: invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, checkout.session.completed.
4. Copy the signing secret (it starts with whsec\_).
5. In the Railway dashboard, open the backend service, then Variables. Add `STRIPE_WEBHOOK_SECRET` = (paste your signing secret).
6. To verify: In Stripe, click "Send test webhook". Check the Railway logs — you should see "Stripe webhook processed".

### 5.5 Connecting SendGrid (10 minutes)

1. Log in to SendGrid at app.sendgrid.com.
2. Go to Settings > API Keys > Create API Key. Select Full Access. Give it a name like "CCW Online".
3. Copy the API key (it starts with SG.).
4. In the Railway dashboard, open the backend service, then Variables. Add the following three variables:
   - `SENDGRID_MODE` = `live`
   - `SENDGRID_API_KEY` = (paste your API key)
   - `SENDGRID_FROM_EMAIL` = (the verified sender email address, e.g. orders@ccwequipment.com.au)
5. In the CCW Online dashboard, go to Settings > Integrations > SendGrid card. Paste the API key and click Save.
6. To verify: Go to the Emails page and send a test email. Check the recipient's inbox to confirm delivery.

---

## 6. Nightly Sync Pipeline

### How It Works

The system automatically syncs data from your existing tools every night via scheduled cron jobs on Vercel. No manual action is needed once integrations are connected. Each job runs at its scheduled time, pulls data from the relevant external service, and updates CCW Online's database. If a job fails, it logs the error and retries on the next scheduled run.

### Schedule (all times AEST)

| Time         | What Happens                                                          | Duration |
| ------------ | --------------------------------------------------------------------- | -------- |
| Every 5 min  | Health check — confirms backend is running                            | < 1 sec  |
| Every 5 min  | Webhook retry — resends any failed webhook deliveries                 | < 5 sec  |
| Every 15 min | SLA check — flags any overdue workflow items                          | < 2 sec  |
| 9:00am       | Daily report — refreshes KPI dashboard + checks expiring quotes       | ~10 sec  |
| 7:00pm       | Cin7 sync — pulls products, inventory, customers, orders from Cin7    | ~15 sec  |
| 8:00pm       | Xero sync — pulls invoices and payments from Xero (after OAuth)       | ~10 sec  |
| 9:00pm       | Auto-reorder — creates draft POs for products below reorder threshold | ~5 sec   |

### How to Verify the Sync Ran

1. Check the Cin7 Sync Status widget on the Dashboard — it shows the last sync timestamp.
2. Go to Products — check that the updated_at timestamps are recent (should reflect last night's sync).
3. If needed, trigger a manual sync: go to Settings > Integrations > Cin7 card > click "Sync Now".

### What to Do If Sync Fails

1. Check the Dashboard for sync error alerts (these appear as red or yellow banners).
2. Verify that API credentials are still valid in Settings > Integrations.
3. Contact Phill if errors persist — a database migration or configuration change may be needed.
4. The system will automatically retry on the next scheduled run, so transient failures often resolve themselves.

---

## 7. Security & Access Control

### Authentication

Every user must log in with email and password. The system uses Supabase Auth, an enterprise-grade identity service. Sessions are managed via JWT tokens stored securely in browser cookies. Tokens refresh automatically, so staff will not be asked to log in repeatedly during the day. All connections are encrypted via HTTPS, meaning data cannot be intercepted in transit.

### Data Isolation

The database enforces Row Level Security (RLS), a database-level control that ensures each organisation can only see its own data. This is enforced at the database engine level, not just in the application code. Even if there were a software bug, data from one organisation cannot leak to another. Protected tables include: organisations, users, products, customers, orders, order items, quotes, quote items, invoices, contacts, suppliers, purchase orders, and more.

### API Security

- **Rate limiting**: 60 requests per minute for general use, 5 per minute for login attempts, to prevent automated abuse.
- **CORS**: Only approved domains (ccwonline.com.au) can make requests to the backend.
- **Cron jobs**: Authenticated with a secret header — they cannot be triggered by external parties.
- **Stripe webhooks**: Cryptographically verified using the signing secret before processing any payment event.

### Data Protection

- **Passwords**: Stored using bcrypt one-way hashing — they cannot be reversed or read by anyone, including system administrators.
- **API keys**: Encrypted at rest using AES-256 encryption.
- **Audit trail**: Every change to orders, quotes, and invoices is logged with who made the change, what was changed, and when.
- **No sensitive data in logs**: Passwords and API tokens are excluded from all log output.

### Access Roles

| Role    | Access Level                                                                        |
| ------- | ----------------------------------------------------------------------------------- |
| Owner   | Full access to all modules including billing and team management                    |
| Admin   | Full operational access — products, customers, orders, inventory, reports, settings |
| Member  | Day-to-day operations — read/write on core modules, view reports                    |
| Billing | Billing and payment management + read-only reports                                  |

---

## 8. Training Guide

### 8.1 Staff Roles

| Role                  | Primary Modules                                     | Core Responsibilities                                             |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Admin / Owner         | All modules + Settings                              | System config, team management, KPI review, integration setup     |
| Sales Rep             | Customers, Quotes, Orders, POS                      | Create quotes, process orders, manage customer relationships      |
| Warehouse / Inventory | Products, Inventory, POS, Purchase Orders, Workshop | Stock management, receiving goods, POS sales, reorder monitoring  |
| Accounts / Finance    | Invoices, Reports, BAS, Bank Feeds                  | Invoice management, payment recording, BAS export, reconciliation |

### 8.2 Daily Routine

**Morning (first 15 minutes)**

1. Open ccwonline.com.au and log in.
2. Check the Dashboard KPI cards — revenue, orders, stock alerts, pending quotes.
3. Check the Cin7 Sync Status widget — last sync should show last night at 7pm.
4. Review any Alerts (bell icon) — red means urgent, yellow means warning.
5. Check Inventory for any critical stock levels (red items).
6. Review overnight auto-generated Purchase Order drafts — approve or edit quantities.

**During the Day**

7. Sales: Work from Quotes and Orders. Keep statuses up to date as things progress.
8. Warehouse: Check Inventory after deliveries arrive. Use the Adjust button for stock corrections.
9. Finance: Check Invoices for newly overdue items. Contact those customers promptly.

**End of Day**

10. POS operators: Run End of Day reconciliation at `/pos/reconciliation`.
11. Sales: Check for quotes expiring today or tomorrow.
12. Log out.

### 8.3 Weekly Tasks

**Admin/Owner — Monday morning**

- Review Customer Health scores at `/customers/health`
- Check weekly revenue trends in Reports
- Verify all integrations show "Connected" in Settings > Integrations
- Clear any resolved Alerts

**Sales — Monday morning**

- Follow up quotes expiring this week
- Chase orders stuck in "Confirmed" status for 3+ days
- Follow up invoices overdue by 7+ days

**Warehouse — Monday morning**

- Review the full stock health table in Inventory
- Check AI Stock Forecast for 30-day stockout risks
- Verify Purchase Orders in transit are on track for their expected delivery dates

**Finance — Friday**

- Export the overdue invoice list to CSV
- Check total Outstanding amount versus last week
- Verify cash payments are recorded in both CCW Online and Xero

### 8.4 Monthly Tasks

**Admin/Owner**

- Run the BAS Report (Invoices > Reports tab) — send the export to your accountant
- Export the Revenue Report from Reports
- Review auto-reorder thresholds for seasonal changes (increase before busy periods)
- Review staff access in Settings > Team — remove any accounts no longer needed

**Warehouse**

- Complete a stocktake for at least one product category
- Review Bill of Materials for assembled products
- Check component stock levels for upcoming production runs

**Finance**

- Run Gross Margin Analysis from Reports
- Cross-check invoice totals against Xero for the month
- Reconcile bank feeds to ensure nothing is missing

### 8.5 Task Walkthroughs

#### How to: Process a POS Walk-In Sale

1. Click **POS** in the sidebar.
2. Search for the product by name, SKU, or scan the barcode.
3. Click the product to add it to the cart.
4. Adjust quantity with the +/- buttons.
5. Select the customer (optional for walk-ins).
6. Choose payment method: Cash, Card, or EFTPOS.
7. Click **Complete Sale**.
8. Print or email the receipt — stock levels update automatically.

#### How to: Create and Send a Quote

1. Click **Quotes** in the sidebar, then click **Create Quote**.
2. Select the customer.
3. Set an expiry date (typically 14 or 30 days).
4. Click **Add Line Item**, search for the product, and enter the quantity.
5. Repeat for each product.
6. Add notes if needed.
7. Click **Save** (saves as Draft).
8. Change status to **Sent** when ready to send to the customer.

#### How to: Convert a Quote to an Order

1. Open the accepted quote in **Quotes**.
2. Change the status to **Accepted** if not already done.
3. Click the **Convert** button.
4. Review the order details in the confirmation dialog.
5. Click **Convert to Order**.
6. The new order appears in Orders with status "Draft".
7. Change status to **Confirmed** to notify the warehouse team.

#### How to: Generate an Invoice from an Order

1. Open the order in **Orders**.
2. Click the invoice icon (document with folded corner) in the Actions column.
3. The system creates an invoice with all line items copied from the order.
4. Check the due date (default: 30 days from today).
5. Change status from Draft to **Sent**.
6. Print or email the invoice to the customer.

#### How to: Record a Payment

1. Open the invoice in **Invoices**.
2. Click the **Payment** button (dollar sign icon).
3. Enter: amount paid, payment method, date, and reference number.
4. Click **Record Payment**.
5. The status updates to "Paid" (full amount) or "Partial" (partial payment).

#### How to: Check and Adjust Stock Levels

1. Click **Inventory** in the sidebar.
2. Products are colour-coded: Red = critical, Orange = low, Green = healthy.
3. Use the search bar or barcode scanner to find a specific product.
4. To adjust: click **Adjust**, enter the new count and a reason, then click **Save**.

#### How to: Create a Purchase Order

1. Click **Purchase Orders**, then click **Create Purchase Order**.
2. Select the supplier.
3. Select the delivery location (Brisbane, Sydney, or Melbourne).
4. Set the expected delivery date.
5. Add line items by searching for products by name or SKU.
6. Click **Save** (saves as Draft).
7. Change status to **Ordered** after sending the PO to the supplier.

#### How to: Receive Goods (GRN)

1. Find the Purchase Order in **Purchase Orders**.
2. Click the three-dot menu, then click **Receive Goods**.
3. For each line item, enter the quantity actually received.
4. Confirm the delivery location.
5. Click **Confirm Receipt**.
6. Stock levels update immediately.

#### How to: Export Data as CSV

1. Navigate to any list page (Products, Customers, Orders, etc.).
2. Apply filters if you want a subset of data.
3. Click the **Export CSV** button (top right of the page).
4. The file downloads automatically — open it in Excel or Google Sheets.

#### How to: Run the BAS Report

1. Click **Invoices**, then click the **Reports** tab.
2. Set the date range to the relevant quarter.
3. Review: GST Collected, GST Paid, Net GST.
4. Click **Download CSV** — send this file to your accountant.
5. Cross-check against your Xero reports for the same period.
6. Important: Run this the morning after quarter-end (after the 8pm Xero sync has pulled the final data).

---

## 9. Export & Reporting

### Available Exports

| Module          | CSV | PDF/Print  | What's Included                                             |
| --------------- | --- | ---------- | ----------------------------------------------------------- |
| Products        | Yes | No         | SKU, name, category, price, cost, stock, location           |
| Customers       | Yes | No         | Customer number, company, contact, email, phone, address    |
| Orders          | Yes | Yes        | Order number, customer, date, status, total, items          |
| Quotes          | Yes | Yes        | Quote number, customer, date, valid until, status, total    |
| Invoices        | Yes | Print view | Invoice number, customer, dates, status, amounts paid/due   |
| Contacts        | Yes | No         | Name, email, phone, job title, department                   |
| Suppliers       | Yes | No         | Code, company, contact, email, ABN, payment terms           |
| Purchase Orders | Yes | No         | PO number, supplier, location, status, total, delivery date |

### Reports Dashboard

The **Reports** page (`/reports`) provides two dashboards:

- **Sales KPIs**: Revenue trends, order volume, average order value, and top customers by spend.
- **Inventory Health**: Stock value, turnover rate, slow-moving items, and stock coverage days.

### BAS Report

The **BAS Report** (`/invoices/bas`) provides Australian GST figures for your Business Activity Statement. Export the data quarterly and send it to your accountant. The report shows GST Collected, GST Paid, and Net GST for the selected period.

---

## 10. Troubleshooting

| Issue                          | Where to Check                                   | Resolution                                                                                       |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Page won't load / white screen | Browser console (press F12)                      | Clear browser cache and cookies, try a different browser                                         |
| Dashboard shows stale data     | Cin7 sync widget on Dashboard                    | Check last sync time. If more than 24 hours old, go to Settings > Integrations > Cin7 > Sync Now |
| Login fails                    | Check credentials                                | Clear cookies, verify email and password. Contact admin for password reset.                      |
| POS not working                | Check internet connection                        | If offline, an orange banner appears. Sales queue locally and sync when reconnected.             |
| Stock levels wrong             | Inventory — check the product                    | Use the Adjust button to correct. Check if Cin7 shows the same count.                            |
| Invoice not syncing to Xero    | Settings > Integrations > Xero                   | Check connection status. May need to re-authorise OAuth.                                         |
| CSV export empty               | Check applied filters                            | Remove all filters first, then try the export again                                              |
| Cron job not running           | Vercel dashboard > Cron Jobs                     | Check the job is listed and Active. Check logs for errors.                                       |
| 500 error on any page          | Vercel logs (frontend) or Railway logs (backend) | Note the URL and time, send to Phill                                                             |

**Emergency Contact**: Phill (Unite Group Development) — for system issues, data problems, or configuration changes.

---

## 11. Technical Appendix

### A. Cron Job Schedule

All times AEST. These run automatically once configured.

> **Corrected 2026-08-07.** The table below now lists what is actually scheduled. Eight endpoints
> previously listed here returned HTTP 501 on every run and have been removed; they are recorded
> underneath so anyone holding an older copy of this report can see what changed. Schedules are
> AEST (Brisbane, UTC+10).

| Time (AEST)  | Endpoint                                   | Purpose                                  |
| ------------ | ------------------------------------------ | ---------------------------------------- |
| Every 5 min  | /api/cron/health-check                     | System health verification               |
| Every 15 min | /api/cron/check-sla-breaches               | SLA monitoring for workflows             |
| Every 15 min | /api/cron/refresh-xero-tokens              | Xero token refresh                       |
| 12:00pm      | /api/cron/cleanup-old-runs                 | Cleanup aged records                     |
| 4:00pm       | /api/cron/sync-bank-feeds                  | Bank feed transaction pull               |
| 7:00pm       | /api/cron/daily-report                     | KPI dashboard refresh                    |
| 8:00pm       | /api/cron/check-invoice-overdue            | Overdue invoice notifications            |
| 9:00pm       | /api/cron/check-trade-finance-maturities   | Trade finance maturity alerts            |
| **9:00pm**   | **/api/cron/nightly-full-sync**            | **Cin7 nightly sync — the one that runs** |

**Removed 2026-08-07 — these never ran.** Each returned HTTP 501 because it forwarded to a backend
service that is not deployed:

`retry-failed-webhooks` · `run-autonomous-ops` · `refresh-health-scores` ·
`check-expiring-quotes` · `process-onboarding-emails` · `shadow-sync-cin7` · `shadow-sync-xero` ·
`auto-reorder-inventory`

The Cin7 capability is covered by `nightly-full-sync`. The others have no replacement: webhook
retry, autonomous operations, CRM health-score refresh, quote-expiry alerts, onboarding email
sequences and automatic purchase-order generation are **not currently happening**, and were not
happening before the removal either.

### B. Environment Variables Reference

> **Corrected 2026-08-07 — there is no Railway backend.** The variables below are real, but they
> belong on the **Vercel** project (`ccw-crm-web`), not on a Railway service. Setting them anywhere
> else configures nothing. `API_UPSTREAM_URL`, referenced by the removed proxy routes, is not
> required and is not part of this product.

#### Backend Environment — CCW Must Configure (set these on Vercel)

| Variable                  | Required    | Description                           |
| ------------------------- | ----------- | ------------------------------------- |
| DATABASE_URL              | Yes         | Supabase PostgreSQL connection string |
| SECRET_KEY                | Yes         | Application secret key                |
| CRON_SECRET               | Yes         | Authentication for scheduled jobs     |
| CIN7_MODE                 | For Cin7    | Set to "live" (currently "demo")      |
| CIN7_CORE_ACCOUNT_ID      | For Cin7    | Cin7 API Account ID                   |
| CIN7_CORE_APPLICATION_KEY | For Cin7    | Cin7 API Application Key              |
| XERO_CLIENT_ID            | For Xero    | Xero OAuth app client ID              |
| XERO_CLIENT_SECRET        | For Xero    | Xero OAuth app secret                 |
| XERO_REDIRECT_URI         | For Xero    | OAuth callback URL                    |
| SHOPIFY_ACCESS_TOKEN      | For Shopify | Shopify Admin API token               |
| SHOPIFY_SHOP_DOMAIN       | For Shopify | e.g. my-store.myshopify.com           |
| STRIPE_SECRET_KEY         | For Stripe  | Stripe API secret key                 |
| STRIPE_WEBHOOK_SECRET     | For Stripe  | Stripe webhook signing secret         |
| SENDGRID_API_KEY          | For email   | SendGrid API key                      |
| SENDGRID_FROM_EMAIL       | For email   | Verified sender address               |

#### Frontend (Vercel)

| Variable                      | Required | Description          |
| ----------------------------- | -------- | -------------------- |
| NEXT_PUBLIC_BACKEND_URL       | Yes      | Railway backend URL  |
| NEXT_PUBLIC_SUPABASE_URL      | Yes      | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes      | Supabase public key  |

### C. Database Schema Summary

| Table           | Key Columns                                      | Relationships               |
| --------------- | ------------------------------------------------ | --------------------------- |
| organizations   | name, slug, is_active                            | Parent for all data         |
| users           | email, full_name, role                           | Belongs to organization     |
| products        | sku (unique), name, category, price, cost, stock | Belongs to organization     |
| customers       | customer_number (unique), company_name, email    | Belongs to organization     |
| orders          | order_number (ORD-YYYY-NNN), status, total       | Belongs to customer         |
| order_items     | quantity, unit_price, line_total                 | Belongs to order + product  |
| quotes          | quote_number (Q-YYYY-NNN), status, total         | Belongs to customer         |
| quote_items     | quantity, unit_price, line_total                 | Belongs to quote + product  |
| invoices        | invoice_number, status, subtotal, tax, total     | Belongs to order + customer |
| suppliers       | company_name, contact, email, payment_terms      | Belongs to organization     |
| purchase_orders | po_number, supplier, status, total               | Belongs to supplier         |

### D. System Requirements

- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Screen**: 1280x800 minimum (responsive down to 390px for mobile)
- **Internet**: Required — this is a cloud-hosted application
- **Software**: None required — runs entirely in the browser
- **Mobile**: Responsive design with hamburger menu on small screens

---

## 12. Go-Live Checklist

Before marking the system as production-ready, all items must pass:

- [ ] Cin7 connected and first sync completed — products visible in /products
- [ ] Xero connected and first sync completed — invoices visible in /invoices
- [ ] Shopify connected — test order flows through to /orders
- [ ] Stripe webhook verified — test webhook returns 200
- [ ] SendGrid connected — test email delivered
- [ ] All sidebar links load without errors (no 404s or white screens)
- [ ] POS processes a test sale successfully
- [ ] CSV export works on Products, Customers, Orders
- [ ] Dashboard shows real KPI data (not demo)
- [ ] Mobile viewport renders correctly (test on phone)
- [ ] No 500 errors in Vercel or Railway logs for 24 hours
- [ ] First nightly Cin7 sync at 7pm AEST completes successfully
- [ ] Staff trained on daily routine (see Section 8)

---

_Document prepared by Unite Group Development. For technical support, contact Phill._
_Last updated: 30 March 2026_
