# CCW CRM-ERP Task List (2026/27)

## Phase A - Demo and Workflow Core
- [x] Live showroom with Shopify feed, search, and category filtering.
- [x] Quote draft supports multiple line items with quantity edits, discount, shipping, and GST toggle.
- [x] Pipeline flow with timestamps plus audit notes for stage updates.
- [x] Invoice preview from showroom order creation.
- [x] Jina product summary refresh and prompt generation.
- [x] Playwright showroom e2e flow updated for multi-line quotes.
- [x] Remove sticky panels in portal workflows (showroom, walk-in, phone, internet).
- [x] Align portal UX and reduce double handling (inline edits, fewer popups).
- [ ] Frontend lint clean-up for high-traffic portal pages (reduce `any` and hook warnings).
- [ ] Resolve remaining image lint warnings by aligning with `next/image` where practical.
- [ ] Confirm deployment target and run production build checks.

## Phase B - Order to Cash Foundation
- [x] Wire showroom "Create order" to backend order API (persist to DB).
- [x] Add invoice export (PDF/CSV).
- [x] Add transaction audit trail.
- [x] Introduce role-aware permissions for order actions.
- [x] Basic fulfillment tracking and delivery updates.
- [x] Add inventory reservations to prevent oversell on quotes/orders.
- [x] Warehouse ops UI hub (receiving, pick/pack, returns, labor plan).

## Phase C - AI and Marketing Automation
- [ ] Connect marketing agent actions to campaign templates and approvals.
- [ ] Add AI-assisted product copy and promo generation from live product data.
- [ ] Staff copilot for quoting and reorder suggestions.
- [ ] Sales insights: account health, overdue risk, and next-best action prompts.

## Phase D - Scale and Multi-Tenant Readiness
- [ ] KPI dashboards for sales and inventory health.
- [ ] Data layer optimizations for high volume feeds.
- [ ] Tenant-aware configuration and client workspaces.

## Phase E - Advanced Operations
- [ ] Warehouse mobile flows (pick/pack/scan).
- [ ] Demand forecasting and automated replenishment.
- [ ] Accounting + 3PL automation integrations.
- [ ] Returns and service ticket workflow integrated with warehouse.

## Testing and Release Gates
- [ ] Backend load smoke test (100 scenarios) before staging.
- [ ] Backend 10,000 scenario load test before production.
- [ ] Lighthouse run on showroom and portal pages.
