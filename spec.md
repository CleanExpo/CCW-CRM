# CCW CRM-ERP Production Spec (2026/27)

## Objective
Deliver a production-ready CRM-ERP platform that replaces Cin7 pain points (double handling, clunky UX) with a fast, modern workflow, full warehouse coverage, and AI intelligence. The system must support live CCW products and be demoable and stable under load.

## Current Status Snapshot
- Showroom demo with Shopify feed, quote pipeline, AI summary prompt, and invoice preview.
- Backend API coverage for products, quotes, orders, customers.
- Load test harness exists with 10,000+ scenario suite in `apps/backend/tests/load`.

## Scope (Full Production)

### Core Modules
1) CRM
   - Accounts, contacts, credit limits, terms, and balances.
   - Opportunities/pipeline, tasks, and activity timeline.
   - Email and call logging with quick follow-up actions.

2) ERP (Sales and Order-to-Cash)
   - Quotes, orders, invoices, payments.
   - Discounts, shipping, tax (GST), and margin visibility.
   - Multi-line items with approvals and audit trails.

3) Inventory and Warehouse (WMS)
   - Multi-location and bin-level inventory.
   - Receiving, putaway, pick, pack, and ship flows.
   - Stock counts, adjustments, transfers, and cycle counts.
   - Warehouse CRM workflows (returns, claims, service tickets).

4) Procurement
   - Suppliers, purchase orders, lead times, and reordering.
   - Cost tracking and landed cost inputs.

5) Marketing Agents Add-on
   - Campaign templates and scheduling.
   - AI-assisted copy and creative briefing.
   - Segmentation and product-based campaign triggers.

### Integrations (Initial)
- Shopify product feed (read-only) with price/tags/category normalization.
- Accounting integration placeholder (Xero) for invoice export.
- Jina Reader for product summaries (allowlist enforced).

## UI/UX Requirements
- Remove sticky panels in portal workflows; avoid pinned sidecards on scroll.
- Reduce double handling: edit inline, auto-calc totals, clear next actions.
- Consistent navigation: highlight active portal tab, collapse on mobile.
- Mobile-first layout: clean hierarchy, generous spacing, no cramped panels.
- Motion: subtle staggered reveals only, no distracting micro-animations.

## AI Intelligence Requirements
- Product summaries from live data (Jina or Shopify fallback).
- Quote and reorder suggestions based on history and margin targets.
- Forecasting: demand and stockout risk with confidence score.
- Sales insights: account health, overdue risk, and next-best actions.
- Operational alerts: slow movers, backorder risk, and vendor delays.

## Data and Architecture
- Canonical models for Product, Customer, Quote, Order, Invoice, InventoryItem.
- Audit logs for key state transitions (quote -> order -> invoice).
- Telemetry for key demo events (showroom visits, pipeline moves, AI actions).

## Non-Functional Requirements
- Performance: LCP < 2.5s for showroom, API p95 < 400ms for core reads.
- Reliability: graceful handling for empty feeds and API timeouts.
- Security: allowlisted external fetches; no secrets on client.
- Accessibility: keyboard navigation, visible focus, readable contrast.

## Testing and Quality Gates

### Frontend
- Unit and component tests: `pnpm -C apps/web test`.
- E2E: `pnpm -C apps/web test:e2e`.
- Lighthouse: `pnpm -C apps/web test:lighthouse` for key portal pages.

### Backend
- Unit/integration: `python -m pytest tests -x --ignore=tests/load`.

### Load and Stress Tests
- Quick smoke: `tests/load/test_scenarios.py::test_quick_smoke_test`.
- Full load: `tests/load/test_scenarios.py::test_10000_realistic_scenarios`.
- Pass rate threshold: 90%+ for production readiness.
- Capture HTML + JSON reports in `apps/backend/tests/load/reports`.

## Deployment Readiness
- Env vars documented and validated on startup.
- Database migrations applied and seed data verified.
- Observability: logs, error traces, and baseline SLO dashboards.

## Roadmap (2026/27)

### Phase A (Now - Q2 2026): Demo and Workflow Core
- Finish showroom UI/UX cleanup, remove sticky panels.
- Harden Shopify feed and product summary fallbacks.
- Complete e2e flow for showroom and quote pipeline.

### Phase B (Q3 2026): Warehouse and Inventory Core
- Multi-location stock, receiving, transfers, pick/pack.
- Warehouse CRM returns and service workflow.
- Purchase order intake and supplier lead times.

### Phase C (Q4 2026): Order-to-Cash and Financials
- Order creation persistence, invoice export, payment tracking.
- Role-based permissions and audit trails.

### Phase D (Q1 2027): AI and Marketing
- AI-driven insights and forecasting.
- Marketing agent workflows and templates.

### Phase E (Q2-Q3 2027): Scale and Multi-Tenant Readiness
- Performance optimization for high-volume clients.
- Tenant-aware config and client workspaces.

## Acceptance Criteria
- All unit, e2e, and load tests pass within targets.
- Warehouse workflows cover receiving, pick/pack, stock counts, transfers.
- No sticky UI panels in portal flows.
- AI insight features available for sales and inventory operations.
- Zero P0/P1 defects in client demo or launch release.
