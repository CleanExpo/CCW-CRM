# Pages Catalog — CCW ERP/CRM Frontend

# Last Updated: 2026-03-03

# Total Pages: 58

# Source: apps/web/app/(dashboard)/

# Sidebar source: apps/web/components/layout/sidebar.tsx

---

## Page Entries

### Domain: Analytics / Dashboard

### PAGE-001: Dashboard

- **Route**: /dashboard
- **File**: `apps/web/app/(dashboard)/dashboard/page.tsx`
- **In Sidebar**: Yes (Dashboard — first entry)
- **Domain**: Analytics
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-002: Reports / KPI

- **Route**: /reports
- **File**: `apps/web/app/(dashboard)/reports/page.tsx`
- **In Sidebar**: Yes (Reports)
- **Domain**: Analytics
- **Status**: Active (UNI-484)
- **Notes**: SalesKpiDashboard + InventoryHealthDashboard tabs
- **Last Verified**: 2026-03-03

### PAGE-003: Insights

- **Route**: /insights
- **File**: `apps/web/app/(dashboard)/insights/page.tsx`
- **In Sidebar**: Yes (Insights)
- **Domain**: Analytics / AI
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-004: Monitoring

- **Route**: /monitoring
- **File**: `apps/web/app/(dashboard)/monitoring/page.tsx`
- **In Sidebar**: Yes (Monitoring)
- **Domain**: Analytics / Infrastructure
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-005: Alerts

- **Route**: /alerts
- **File**: `apps/web/app/(dashboard)/alerts/page.tsx`
- **In Sidebar**: Yes (Alerts)
- **Domain**: Analytics / Monitoring
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-006: Demo

- **Route**: /demo
- **File**: `apps/web/app/(dashboard)/demo/page.tsx`
- **In Sidebar**: No
- **Domain**: Demo / Internal
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-007: Demo Live

- **Route**: /demo-live
- **File**: `apps/web/app/(dashboard)/demo-live/page.tsx`
- **In Sidebar**: No
- **Domain**: Demo / Landing
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Inventory

### PAGE-008: Inventory Overview

- **Route**: /inventory
- **File**: `apps/web/app/(dashboard)/inventory/page.tsx`
- **In Sidebar**: Yes (Inventory Overview)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-009: Stock List

- **Route**: /inventory/stock
- **File**: `apps/web/app/(dashboard)/inventory/stock/page.tsx`
- **In Sidebar**: Yes (Stock List)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-010: Stock Transfers

- **Route**: /inventory/transfers
- **File**: `apps/web/app/(dashboard)/inventory/transfers/page.tsx`
- **In Sidebar**: Yes (Stock Transfers)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-011: Stock Transfer Detail

- **Route**: /inventory/transfers/[id]
- **File**: `apps/web/app/(dashboard)/inventory/transfers/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-012: Inventory Reservations

- **Route**: /inventory/reservations
- **File**: `apps/web/app/(dashboard)/inventory/reservations/page.tsx`
- **In Sidebar**: Yes (Reservations)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-013: Inventory Forecast

- **Route**: /inventory/forecast
- **File**: `apps/web/app/(dashboard)/inventory/forecast/page.tsx`
- **In Sidebar**: Yes (Stock Forecast)
- **Domain**: Inventory / AI
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-014: Products

- **Route**: /products
- **File**: `apps/web/app/(dashboard)/products/page.tsx`
- **In Sidebar**: Yes (Products)
- **Domain**: Inventory / Catalog
- **Status**: Active
- **Notes**: CSV export button, keyword-rich H1, ProductSchema JSON-LD
- **Last Verified**: 2026-03-03

### PAGE-015: Product Detail

- **Route**: /products/[id]
- **File**: `apps/web/app/(dashboard)/products/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: Inventory / Catalog
- **Status**: Active (UNI-1233)
- **Notes**: ProductSchema JSON-LD, stats grid (price/cost/stock/margin), Edit modal
- **Last Verified**: 2026-03-03

### PAGE-016: Containers

- **Route**: /containers
- **File**: `apps/web/app/(dashboard)/containers/page.tsx`
- **In Sidebar**: Yes (Containers)
- **Domain**: Inventory / Logistics
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-017: Container Detail

- **Route**: /containers/[id]
- **File**: `apps/web/app/(dashboard)/containers/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: Inventory / Logistics
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-018: Backorders

- **Route**: /backorders
- **File**: `apps/web/app/(dashboard)/backorders/page.tsx`
- **In Sidebar**: Yes (Backorders)
- **Domain**: Inventory
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-019: Warehouse

- **Route**: /warehouse
- **File**: `apps/web/app/(dashboard)/warehouse/page.tsx`
- **In Sidebar**: Yes (Warehouse Ops)
- **Domain**: Inventory / Logistics
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-020: Shipments

- **Route**: /shipments
- **File**: `apps/web/app/(dashboard)/shipments/page.tsx`
- **In Sidebar**: No (not in sidebar.tsx nav array — may have been removed)
- **Domain**: Inventory / Logistics
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: CRM

### PAGE-021: Customers

- **Route**: /customers
- **File**: `apps/web/app/(dashboard)/customers/page.tsx`
- **In Sidebar**: Yes (Customers)
- **Domain**: CRM
- **Status**: Active
- **Notes**: CSV export button, keyword-rich H1
- **Last Verified**: 2026-03-03

### PAGE-022: Customer Detail

- **Route**: /customers/[id]
- **File**: `apps/web/app/(dashboard)/customers/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: CRM
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-023: Contacts

- **Route**: /contacts
- **File**: `apps/web/app/(dashboard)/contacts/page.tsx`
- **In Sidebar**: Yes (Contacts)
- **Domain**: CRM
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-024: Activities

- **Route**: /activities
- **File**: `apps/web/app/(dashboard)/activities/page.tsx`
- **In Sidebar**: Yes (Activities)
- **Domain**: CRM
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-025: Suppliers

- **Route**: /suppliers
- **File**: `apps/web/app/(dashboard)/suppliers/page.tsx`
- **In Sidebar**: No (not in sidebar.tsx nav array)
- **Domain**: CRM / Procurement
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-026: Tasks

- **Route**: /tasks
- **File**: `apps/web/app/(dashboard)/tasks/page.tsx`
- **In Sidebar**: No
- **Domain**: CRM / Workflow
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Orders

### PAGE-027: Orders

- **Route**: /orders
- **File**: `apps/web/app/(dashboard)/orders/page.tsx`
- **In Sidebar**: Yes (Orders)
- **Domain**: Orders
- **Status**: Active
- **Notes**: CSV export button, PDF export button, keyword-rich H1 (UNI-1234)
- **Last Verified**: 2026-03-03

### PAGE-028: Order Invoice

- **Route**: /orders/[id]/invoice
- **File**: `apps/web/app/(dashboard)/orders/[id]/invoice/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: Orders / Financial
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-029: Quotes

- **Route**: /quotes
- **File**: `apps/web/app/(dashboard)/quotes/page.tsx`
- **In Sidebar**: Yes (Quotes)
- **Domain**: Orders
- **Status**: Active
- **Notes**: CSV export button, PDF export button (UNI-1234)
- **Last Verified**: 2026-03-03

### PAGE-030: Quote Generator

- **Route**: /quotes/generate
- **File**: `apps/web/app/(dashboard)/quotes/generate/page.tsx`
- **In Sidebar**: No
- **Domain**: Orders / AI
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-031: Purchase Orders

- **Route**: /purchase-orders
- **File**: `apps/web/app/(dashboard)/purchase-orders/page.tsx`
- **In Sidebar**: Yes (Purchase Orders)
- **Domain**: Orders / Procurement
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Financial / POS

### PAGE-032: Invoices

- **Route**: /invoices
- **File**: `apps/web/app/(dashboard)/invoices/page.tsx`
- **In Sidebar**: Yes (Invoices)
- **Domain**: Financial
- **Status**: Active (UNI-173)
- **Last Verified**: 2026-03-03

### PAGE-033: Invoice Detail

- **Route**: /invoices/[id]
- **File**: `apps/web/app/(dashboard)/invoices/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: Financial
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-034: POS Terminal

- **Route**: /pos
- **File**: `apps/web/app/(dashboard)/pos/page.tsx`
- **In Sidebar**: Yes (POS Terminal)
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-035: POS Locations

- **Route**: /pos/locations
- **File**: `apps/web/app/(dashboard)/pos/locations/page.tsx`
- **In Sidebar**: No
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-036: POS Reconciliation

- **Route**: /pos/reconciliation
- **File**: `apps/web/app/(dashboard)/pos/reconciliation/page.tsx`
- **In Sidebar**: Yes (Reconciliation)
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-037: POS Staff

- **Route**: /pos/staff
- **File**: `apps/web/app/(dashboard)/pos/staff/page.tsx`
- **In Sidebar**: No
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-038: POS Terminal Config

- **Route**: /pos/terminal
- **File**: `apps/web/app/(dashboard)/pos/terminal/page.tsx`
- **In Sidebar**: No
- **Domain**: Financial / POS
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-039: Reconciliation

- **Route**: /reconciliation
- **File**: `apps/web/app/(dashboard)/reconciliation/page.tsx`
- **In Sidebar**: No (not a sidebar entry; sidebar links to /pos/reconciliation)
- **Domain**: Financial
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: AI / Development

### PAGE-040: AI Assistant

- **Route**: /ai-assistant
- **File**: `apps/web/app/(dashboard)/ai-assistant/page.tsx`
- **In Sidebar**: No (commented out — incomplete implementation)
- **Domain**: AI
- **Status**: Hidden (sidebar entry commented out)
- **Last Verified**: 2026-03-03

### PAGE-041: Agents

- **Route**: /agents
- **File**: `apps/web/app/(dashboard)/agents/page.tsx`
- **In Sidebar**: No
- **Domain**: AI / Infrastructure
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-042: Autonomous Dev

- **Route**: /autonomous-dev
- **File**: `apps/web/app/(dashboard)/autonomous-dev/page.tsx`
- **In Sidebar**: No
- **Domain**: AI / Development
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-043: PRD Generate

- **Route**: /prd/generate
- **File**: `apps/web/app/(dashboard)/prd/generate/page.tsx`
- **In Sidebar**: Yes (PRD Generator)
- **Domain**: AI / Content
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-044: PRD Detail

- **Route**: /prd/[id]
- **File**: `apps/web/app/(dashboard)/prd/[id]/page.tsx`
- **In Sidebar**: No (dynamic route)
- **Domain**: AI / Content
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Content / Marketing

### PAGE-045: FAQ

- **Route**: /faq
- **File**: `apps/web/app/(dashboard)/faq/page.tsx`
- **In Sidebar**: Yes (FAQ)
- **Domain**: Content / SEO
- **Status**: Active (UNI-782/783)
- **Notes**: FAQPage schema JSON-LD, 10 Q&As
- **Last Verified**: 2026-03-03

### PAGE-046: Marketing

- **Route**: /marketing
- **File**: `apps/web/app/(dashboard)/marketing/page.tsx`
- **In Sidebar**: Yes (Marketing)
- **Domain**: Content / Marketing
- **Status**: Active (UNI-1232)
- **Last Verified**: 2026-03-03

### PAGE-047: Emails

- **Route**: /emails
- **File**: `apps/web/app/(dashboard)/emails/page.tsx`
- **In Sidebar**: Yes (Emails)
- **Domain**: Content / CRM
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Workflow / Approvals

### PAGE-048: Approvals

- **Route**: /approvals
- **File**: `apps/web/app/(dashboard)/approvals/page.tsx`
- **In Sidebar**: Yes (Approvals)
- **Domain**: Workflow
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-049: Submissions

- **Route**: /submissions
- **File**: `apps/web/app/(dashboard)/submissions/page.tsx`
- **In Sidebar**: Yes (Submissions)
- **Domain**: Workflow / Portal Forms
- **Status**: Active
- **Last Verified**: 2026-03-03

---

### Domain: Settings

### PAGE-050: Settings — Integrations

- **Route**: /settings/integrations
- **File**: `apps/web/app/(dashboard)/settings/integrations/page.tsx`
- **In Sidebar**: Yes (Settings — links to /settings/integrations)
- **Domain**: Settings
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-051: Settings — Account

- **Route**: /settings/account
- **File**: `apps/web/app/(dashboard)/settings/account/page.tsx`
- **In Sidebar**: No (sub-page)
- **Domain**: Settings
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-052: Settings — Billing

- **Route**: /settings/billing
- **File**: `apps/web/app/(dashboard)/settings/billing/page.tsx`
- **In Sidebar**: No (sub-page)
- **Domain**: Settings / Financial
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-053: Settings — Company

- **Route**: /settings/company
- **File**: `apps/web/app/(dashboard)/settings/company/page.tsx`
- **In Sidebar**: No (sub-page)
- **Domain**: Settings
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-054: Settings — Team

- **Route**: /settings/team
- **File**: `apps/web/app/(dashboard)/settings/team/page.tsx`
- **In Sidebar**: No (sub-page)
- **Domain**: Settings
- **Status**: Active
- **Last Verified**: 2026-03-03

### PAGE-055: Settings — Translations

- **Route**: /settings/translations
- **File**: `apps/web/app/(dashboard)/settings/translations/page.tsx`
- **In Sidebar**: No (sub-page)
- **Domain**: Settings / i18n
- **Status**: Active
- **Last Verified**: 2026-03-03
