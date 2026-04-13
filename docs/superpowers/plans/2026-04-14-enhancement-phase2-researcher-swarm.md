# Enhancement Program — Phase 2: Researcher Swarm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all 16 researcher agent definitions — 9 vertical (internal modules) and 5 horizontal (external platforms) — plus the finding format standard they all write to.

**Architecture:** Each researcher is a Markdown agent definition under `.claude/agents/researchers/`. They share a common finding format. Vertical researchers audit source code and routes. Horizontal researchers fetch live API docs and compare against current integration code.

**Tech Stack:** Claude Code agent definitions (Markdown), Tools: Read, Glob, Grep, WebFetch, WebSearch, Write (to memory store)

---

## File Map

| Action | Path                                                          | Purpose                             |
| ------ | ------------------------------------------------------------- | ----------------------------------- |
| Create | `.claude/agents/researchers/FINDING-FORMAT.md`                | Shared finding template             |
| Create | `.claude/agents/researchers/vertical/orders-quotes.md`        | Orders & Quotes researcher          |
| Create | `.claude/agents/researchers/vertical/products-inventory.md`   | Products & Inventory researcher     |
| Create | `.claude/agents/researchers/vertical/customers-crm.md`        | Customers & CRM researcher          |
| Create | `.claude/agents/researchers/vertical/pos-reconciliation.md`   | POS & Reconciliation researcher     |
| Create | `.claude/agents/researchers/vertical/purchasing-suppliers.md` | Purchasing & Suppliers researcher   |
| Create | `.claude/agents/researchers/vertical/warehouse-shipments.md`  | Warehouse & Shipments researcher    |
| Create | `.claude/agents/researchers/vertical/ai-agents.md`            | AI Agents & Intelligence researcher |
| Create | `.claude/agents/researchers/vertical/workshop-service.md`     | Workshop & Service researcher       |
| Create | `.claude/agents/researchers/vertical/settings-security.md`    | Settings & Security researcher      |
| Create | `.claude/agents/researchers/horizontal/xero.md`               | Xero API researcher                 |
| Create | `.claude/agents/researchers/horizontal/cin7.md`               | Cin7 API researcher                 |
| Create | `.claude/agents/researchers/horizontal/shopify.md`            | Shopify API researcher              |
| Create | `.claude/agents/researchers/horizontal/stripe.md`             | Stripe API researcher               |
| Create | `.claude/agents/researchers/horizontal/shipping-tbd.md`       | Shipping/Stock researcher           |
| Create | `.claude/memory/enhancement-program/research/*.md`            | One findings file per domain        |

---

### Task 1: Finding Format Standard

**Files:**

- Create: `.claude/agents/researchers/FINDING-FORMAT.md`

- [ ] **Step 1: Create researcher directory**

```bash
mkdir -p ".claude/agents/researchers/vertical"
mkdir -p ".claude/agents/researchers/horizontal"
```

- [ ] **Step 2: Write FINDING-FORMAT.md**

Create `.claude/agents/researchers/FINDING-FORMAT.md`:

````markdown
# Finding Format Standard

All researcher agents write findings in this exact format to their domain memory file.

## File Header

```markdown
# [Domain] Research Findings

**Researcher**: [domain-name]
**Date**: [DD/MM/YYYY]
**Total findings**: N
**Files audited**: N
```
````

## Per Finding

```markdown
### Finding #N: [Short action-oriented title]

**Score hint**: CRITICAL / HIGH / MEDIUM / LOW
**Tags**: [domain] · [au-compliance|gst|ato|ux|security|integration] · [platform if applicable]
**Effort estimate**: [< 1 day | 1–3 days | 1–2 weeks | > 2 weeks]

**Gap**: [What is missing or broken — 2-3 sentences]

**Business impact**: [Why this matters for a $5-10M AU equipment supplier — 1-2 sentences]

**Affected files**:

- `exact/path/to/file.py:line_range`
- `exact/path/to/component.tsx`

**Suggested approach**: [What needs to be built/changed — 1-3 sentences]

## **Cross-platform**: [YES/NO — if YES, note which platform shares this gap]
```

````

- [ ] **Step 3: Commit**

```bash
git add ".claude/agents/researchers/FINDING-FORMAT.md"
git commit -m "feat(enhancement): add finding format standard — Phase 2"
````

---

### Task 2: Vertical Researcher Agents (9 agents)

**Files:** All paths listed in file map above under `vertical/`

- [ ] **Step 1: Create orders-quotes.md**

Create `.claude/agents/researchers/vertical/orders-quotes.md`:

```markdown
---
name: Orders & Quotes Researcher
description: Audits the Orders and Quotes modules for gaps vs $5-10M AU business needs
---

# Orders & Quotes Researcher

**Model**: claude-sonnet-4-6
**Domain**: Orders, Quotes, Invoices
**Memory output**: `.claude/memory/enhancement-program/research/orders-quotes.md`

## Scope

Audit these source files:

- `apps/backend/src/api/routes/` — orders.py, quotes.py, invoices.py, invoice_payments.py
- `apps/web/app/(dashboard)/orders/` — all page and component files
- `apps/web/app/(dashboard)/quotes/` — all page and component files
- `apps/backend/src/db/demo_models.py` — Order, Quote, Invoice model fields (READ ONLY)

## What to Look For

1. **Flow completeness**: Can a staff member create quote → approve → convert to order → invoice → receive payment without leaving the app?
2. **AU payment terms**: Net 30/60/90 support, EFT reference fields, remittance advice
3. **Quote expiry**: Auto-expiry, expiry notifications, re-quoting workflow
4. **GST handling**: Is GST calculated correctly? Is it shown on quotes/invoices?
5. **PDF generation**: Are quote and invoice PDFs generated? Do they meet AU tax invoice requirements? (ABN, GST amount shown separately, "Tax Invoice" heading)
6. **Status transitions**: Are all status changes logged? Can statuses go backwards correctly?
7. **Partial payments**: Can invoices track partial payments?
8. **Credit notes**: Is there a credit note workflow?
9. **Bulk operations**: Can staff bulk-approve quotes or bulk-send invoices?
10. **Search and filter**: Can orders/quotes be searched by customer, date range, status, value?

## AU Compliance Checks

- Tax invoices must show: supplier ABN, "Tax Invoice" heading, GST amount, date, sequential number
- BAS reporting: are GST amounts trackable by period?
- Payment terms: are standard AU terms (Net 30 EOM, COD, etc.) supported?

## Output

Write all findings to `.claude/memory/enhancement-program/research/orders-quotes.md` using FINDING-FORMAT.md.
Read `.claude/memory/enhancement-program/decisions/audit-trail.md` first — skip anything already decided.
Update `.claude/memory/enhancement-program/status.md` row for "Orders & Quotes" when complete.
```

- [ ] **Step 2: Create products-inventory.md**

Create `.claude/agents/researchers/vertical/products-inventory.md`:

```markdown
---
name: Products & Inventory Researcher
description: Audits Products and Inventory modules for gaps vs $5-10M AU business needs
---

# Products & Inventory Researcher

**Model**: claude-sonnet-4-6
**Domain**: Products, Stock, Categories, Pricing
**Memory output**: `.claude/memory/enhancement-program/research/products-inventory.md`

## Scope

- `apps/backend/src/api/routes/products.py`, `inventory.py`, `pricing.py`
- `apps/web/app/(dashboard)/products/` — all files
- `apps/web/app/(dashboard)/inventory/` — all files
- `apps/backend/src/db/demo_models.py` — Product, Inventory model fields (READ ONLY)

## What to Look For

1. **SKU management**: Bulk SKU import/export (CSV), SKU validation, duplicate prevention
2. **Variants**: Does the product model support variants (size/colour/spec)?
3. **Low-stock alerts**: Configurable threshold per SKU, notification channel
4. **Reorder points**: Automatic reorder point calculation based on lead time
5. **Pricing tiers**: Volume pricing, customer-group pricing, trade vs retail
6. **Cost tracking**: COGS per product, landed cost (freight + duties)
7. **Images**: Multi-image support, image CDN, thumbnail generation
8. **Categories**: Hierarchical categories, bulk re-categorisation
9. **Barcode**: Barcode/QR generation per SKU
10. **Stock takes**: Cycle count workflow, stock adjustment with reason codes

## AU Compliance Checks

- GST-inclusive vs GST-exclusive pricing display
- Duty/customs code fields for import products
- Country of origin tracking

## Output

Write findings to `.claude/memory/enhancement-program/research/products-inventory.md`.
```

- [ ] **Step 3: Create customers-crm.md**

Create `.claude/agents/researchers/vertical/customers-crm.md`:

```markdown
---
name: Customers & CRM Researcher
description: Audits Customers and CRM modules for gaps vs $5-10M AU business needs
---

# Customers & CRM Researcher

**Model**: claude-sonnet-4-6
**Domain**: Customers, Contacts, Activities, CRM pipeline
**Memory output**: `.claude/memory/enhancement-program/research/customers-crm.md`

## Scope

- `apps/backend/src/api/routes/customers.py`, `contacts.py`, `activities.py`
- `apps/web/app/(dashboard)/customers/` — all files
- `apps/backend/src/db/demo_models.py` — Customer, Contact model fields (READ ONLY)

## What to Look For

1. **AU ABN validation**: Is ABN validated (11-digit, checksum)?
2. **Company vs individual**: Is there a clear B2B / B2C distinction?
3. **Contact hierarchy**: Multiple contacts per customer, primary contact designation
4. **Activity timeline**: Call logs, email history, visit notes — full timeline per customer
5. **Customer portal**: Can customers log in to view their orders/invoices?
6. **Credit limit**: Per-customer credit limit, credit hold workflow
7. **Payment terms**: Per-customer default payment terms
8. **Customer groups**: Segmentation for pricing, comms, reporting
9. **Duplicate detection**: Are duplicate customers flagged on create?
10. **Import/export**: CSV bulk import of customers with field mapping

## AU Compliance Checks

- ABN field and validation
- Privacy Act 1988 — data retention and deletion workflow
- State field: AU states (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)

## Output

Write findings to `.claude/memory/enhancement-program/research/customers-crm.md`.
```

- [ ] **Step 4: Create pos-reconciliation.md**

Create `.claude/agents/researchers/vertical/pos-reconciliation.md`:

```markdown
---
name: POS & Reconciliation Researcher
description: Audits POS and bank reconciliation modules
---

# POS & Reconciliation Researcher

**Model**: claude-sonnet-4-6
**Domain**: POS Transactions, Bank Feeds, Reconciliation
**Memory output**: `.claude/memory/enhancement-program/research/pos-reconciliation.md`

## Scope

- `apps/backend/src/api/routes/` — pos_transactions.py, bank_feeds.py, reconciliation.py
- `apps/web/app/(dashboard)/pos/` — all files
- `apps/web/app/(dashboard)/reconciliation/` — all files

## What to Look For

1. **Cash handling**: End-of-day cash count, float management, cash discrepancy workflow
2. **EFTPOS integration**: EFTPOS terminal integration or manual entry
3. **Refunds**: POS refund workflow, refund receipt
4. **Split payments**: Cash + card on one transaction
5. **GST on POS**: Is GST calculated and receipted correctly?
6. **Bank feed matching**: Auto-match confidence, manual match override
7. **Unreconciled items**: Aged unreconciled report
8. **Xero sync**: Do reconciled items push to Xero automatically?
9. **Daily summary**: End-of-day POS summary report
10. **Receipt printing**: Digital receipt (email/SMS) + thermal printer support

## AU Compliance Checks

- GST on receipts (required for amounts > $82.50 incl. GST)
- Cash handling procedures (ATO requirements)
- BAS reconciliation readiness

## Output

Write findings to `.claude/memory/enhancement-program/research/pos-reconciliation.md`.
```

- [ ] **Step 5: Create purchasing-suppliers.md**

Create `.claude/agents/researchers/vertical/purchasing-suppliers.md`:

```markdown
---
name: Purchasing & Suppliers Researcher
description: Audits Purchase Orders and Supplier modules
---

# Purchasing & Suppliers Researcher

**Model**: claude-sonnet-4-6
**Domain**: Purchase Orders, Suppliers, GRN, 3-way match
**Memory output**: `.claude/memory/enhancement-program/research/purchasing-suppliers.md`

## Scope

- `apps/backend/src/api/routes/` — purchase_orders.py, suppliers.py, procurement.py
- `apps/web/app/(dashboard)/purchase-orders/` — all files
- `apps/web/app/(dashboard)/suppliers/` — all files

## What to Look For

1. **3-way match**: PO → GRN → supplier invoice matching workflow
2. **GRN workflow**: Goods received note with partial receipt support
3. **Supplier portal**: Can suppliers view their POs and submit invoices online?
4. **Lead times**: Per-supplier lead time tracking, expected delivery dates
5. **Preferred suppliers**: Per-product preferred supplier with fallback
6. **Price history**: Supplier price history per SKU
7. **Payment terms**: Per-supplier payment terms (30/60/90 days)
8. **AP ageing**: Accounts payable ageing report
9. **Backorders**: Supplier backorder management and ETA tracking
10. **PO approval**: PO approval workflow for amounts above threshold

## AU Compliance Checks

- Supplier ABN validation
- RCTI (Recipient Created Tax Invoice) support for some supplier arrangements
- ATO contractor reporting requirements

## Output

Write findings to `.claude/memory/enhancement-program/research/purchasing-suppliers.md`.
```

- [ ] **Step 6: Create warehouse-shipments.md**

Create `.claude/agents/researchers/vertical/warehouse-shipments.md`:

```markdown
---
name: Warehouse & Shipments Researcher
description: Audits Warehouse and Shipments modules
---

# Warehouse & Shipments Researcher

**Model**: claude-sonnet-4-6
**Domain**: Warehouse, Shipments, Containers, Backorders
**Memory output**: `.claude/memory/enhancement-program/research/warehouse-shipments.md`

## Scope

- `apps/backend/src/api/routes/` — warehouse.py, shipments.py, containers.py, backorders.py
- `apps/web/app/(dashboard)/warehouse/` — all files
- `apps/web/app/(dashboard)/shipments/` — all files

## What to Look For

1. **Pick/pack workflow**: Pick list generation, packing slip, scan to confirm
2. **Multi-location**: Multi-bin / multi-warehouse support
3. **Freight integration**: Does the shipping platform (Starshipit/Shippit) integrate?
4. **Tracking**: Real-time shipment tracking visible to staff and customers
5. **Container management**: Container arrival, devanning, stock allocation
6. **Backorder fulfilment**: When stock arrives, does it auto-allocate to backorders?
7. **Dispatch notifications**: Customer notification on dispatch (email/SMS)
8. **Returns**: Return merchandise authorisation (RMA) workflow
9. **Serial/lot tracking**: Serial number or batch/lot tracking per item
10. **Freight cost**: Freight cost captured per shipment, landed cost calculation

## AU Compliance Checks

- Dangerous goods documentation (relevant for cleaning equipment chemicals)
- AU Customs import documentation for container arrivals

## Output

Write findings to `.claude/memory/enhancement-program/research/warehouse-shipments.md`.
```

- [ ] **Step 7: Create ai-agents.md**

Create `.claude/agents/researchers/vertical/ai-agents.md`:

```markdown
---
name: AI Agents & Intelligence Researcher
description: Audits AI agent coverage, protocol compliance, and intelligence gaps
---

# AI Agents & Intelligence Researcher

**Model**: claude-sonnet-4-6
**Domain**: AI agents, protocol, orchestration, intelligence features
**Memory output**: `.claude/memory/enhancement-program/research/ai-agents.md`

## Scope

- `apps/backend/src/ai/agents/` — all agent files
- `apps/backend/src/ai/protocol/` — protocol files
- `apps/backend/src/ai/orchestration/` — registry, supervisor
- `docs/catalogs/AGENTS.md` — catalog of all agents

## What to Look For

1. **Protocol compliance**: Do all agents have registered AgentCards? Check against protocol/cards/
2. **Coverage gaps**: Which ERP modules have NO AI agent? (e.g. is there a quote-generation agent?)
3. **Confidence scoring**: Are all agents using protocol_execute() for confidence tracking?
4. **Supervisor routing**: Does SupervisorAgent route to all available agents?
5. **Human-in-loop**: Which agents require human approval before acting?
6. **Memory/learning**: Is the learning engine used? Is it improving recommendations?
7. **Streaming**: Do all chat-style agents support SSE streaming?
8. **Error recovery**: Do agents handle Anthropic API errors with retry logic?
9. **Cost tracking**: Is token usage tracked per agent per session?
10. **Latest models**: Are agents using claude-haiku-4-5 or above? Flag any using older models.

## Output

Write findings to `.claude/memory/enhancement-program/research/ai-agents.md`.
Fetch latest model list from: https://platform.claude.com/docs/en/home
```

- [ ] **Step 8: Create workshop-service.md**

Create `.claude/agents/researchers/vertical/workshop-service.md`:

```markdown
---
name: Workshop & Service Researcher
description: Audits Workshop and Service Request modules
---

# Workshop & Service Researcher

**Model**: claude-sonnet-4-6
**Domain**: Workshop, Service Requests, Equipment Lifecycle, Certifications
**Memory output**: `.claude/memory/enhancement-program/research/workshop-service.md`

## Scope

- `apps/backend/src/api/routes/` — service_requests.py, equipment_lifecycle.py, certifications.py
- `apps/web/app/(dashboard)/workshop/` — all files
- `apps/web/app/(dashboard)/service-requests/` — all files

## What to Look For

1. **Job cards**: Digital job card creation, technician assignment, time logging
2. **Parts usage**: Parts consumed per job (links to inventory)
3. **Service history**: Full service history per machine/asset
4. **Customer equipment register**: Track customer-owned equipment by serial number
5. **Certifications**: IICRC and other AU certifications tracked per technician
6. **Service reminders**: Scheduled service reminders (e.g. annual service due)
7. **Warranty tracking**: Warranty periods per equipment sold
8. **Labour rates**: Per-technician or per-job-type labour rate billing
9. **Photos**: Before/after photos attached to job cards
10. **Customer sign-off**: Digital signature on job completion

## AU Compliance Checks

- Electrical safety certificates (relevant for powered cleaning equipment)
- AU consumer law warranty obligations (1-year statutory warranty minimum)

## Output

Write findings to `.claude/memory/enhancement-program/research/workshop-service.md`.
```

- [ ] **Step 9: Create settings-security.md**

Create `.claude/agents/researchers/vertical/settings-security.md`:

```markdown
---
name: Settings & Security Researcher
description: Audits Settings, Auth, RLS, and AU compliance posture
---

# Settings & Security Researcher

**Model**: claude-sonnet-4-6
**Domain**: Settings, Auth, RLS, Data Security, AU Compliance
**Memory output**: `.claude/memory/enhancement-program/research/settings-security.md`

## Scope

- `apps/backend/src/api/routes/` — settings.py, demo_auth.py (READ ONLY — do not suggest changes)
- `apps/web/app/(dashboard)/settings/` — all files
- `apps/web/middleware.ts` — READ ONLY
- Supabase RLS policies (read via Linear/memory context only)

## What to Look For

1. **User roles**: Are there granular roles (admin, manager, staff, read-only)?
2. **Audit log**: Is there a full audit log of data changes with user attribution?
3. **2FA**: Is two-factor authentication available?
4. **API keys**: Are API keys (Xero, Cin7, Anthropic) stored securely in DB vs env?
5. **Session management**: Session timeout, concurrent session limits
6. **Data export**: Can admins export all their data (Privacy Act compliance)?
7. **Data retention**: Is there a configurable data retention policy?
8. **Email settings**: Custom from-address, SMTP configuration
9. **Notification preferences**: Per-user notification settings (email, in-app, SMS)
10. **Onboarding completeness**: Does the wizard cover all required setup steps?

## AU Compliance Checks

- Privacy Act 1988 — right to access and deletion
- Notifiable Data Breaches scheme — is there an incident response workflow?
- ASD Essential Eight — MFA, application control, patching

## IMPORTANT

DO NOT suggest changes to `middleware.ts` or `demo_auth.py` — these are locked files.
Flag security gaps as findings only — do not attempt remediation.

## Output

Write findings to `.claude/memory/enhancement-program/research/settings-security.md`.
```

- [ ] **Step 10: Commit all vertical researchers**

```bash
git add ".claude/agents/researchers/"
git commit -m "feat(enhancement): add 9 vertical researcher agent definitions — Phase 2"
```

---

### Task 3: Horizontal Researcher Agents (5 agents)

- [ ] **Step 1: Create xero.md**

Create `.claude/agents/researchers/horizontal/xero.md`:

```markdown
---
name: Xero API Researcher
description: Audits Xero API capabilities vs current CCW integration
---

# Xero API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Xero accounting platform integration
**Memory output**: `.claude/memory/enhancement-program/research/integrations-xero.md`

## Scope

Current integration code:

- `apps/backend/src/integrations/` — xero files
- `apps/backend/src/api/routes/` — xero.py route

Xero API docs to fetch:

- https://developer.xero.com/documentation/api/accounting/overview
- https://developer.xero.com/documentation/api/accounting/invoices
- https://developer.xero.com/documentation/api/accounting/banktransactions
- https://developer.xero.com/documentation/api/accounting/reports (BAS)
- https://developer.xero.com/documentation/api/payroll-au/overview

## What to Look For

For each Xero API capability, check: does CCW currently use it?

1. **BAS report**: Auto-generate BAS from Xero data — CRITICAL for AU compliance
2. **Bank reconciliation**: Xero bank feed → CCW reconciliation sync
3. **Purchase orders**: Xero PO sync with CCW purchase orders
4. **Payroll AU**: Payroll integration (STP Phase 2 compliance)
5. **Fixed assets**: Equipment as fixed assets in Xero
6. **Tracking categories**: Department/location tracking in Xero
7. **Repeating invoices**: Subscription/retainer billing
8. **Credit notes**: Credit note sync between CCW and Xero
9. **Contacts sync**: Xero contacts ↔ CCW customers bidirectional sync
10. **Webhooks**: Real-time Xero event notifications to CCW

## Cross-Platform Flag

For any gap found, check if the Orders, Quotes, or POS researcher also flagged the same area.
Note in finding: `Cross-platform: YES — also flagged by [domain] researcher`

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-xero.md`.
Update cross-platform opportunity map if any cross-platform gaps found.
```

- [ ] **Step 2: Create cin7.md**

Create `.claude/agents/researchers/horizontal/cin7.md`:

```markdown
---
name: Cin7 API Researcher
description: Audits Cin7 API capabilities vs current CCW integration
---

# Cin7 API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Cin7 inventory management platform
**Memory output**: `.claude/memory/enhancement-program/research/integrations-cin7.md`

## Scope

Current integration code:

- `apps/backend/src/integrations/` — cin7 files (multiple phases)
- `apps/backend/src/api/routes/` — cin7\*.py routes (10+ files)
- `apps/backend/src/ai/agents/specialized/` — cin7_forecasting_agent.py, cin7_anomaly_agent.py

Cin7 API docs to fetch:

- https://developer.cin7.com/
- https://api.cin7.com/api/reference (REST reference)

## What to Look For

1. **Webhook coverage**: Which Cin7 webhooks are subscribed? Which are not?
2. **Product sync completeness**: Are all Cin7 product fields mapped to CCW?
3. **Sales order push**: Does CCW push confirmed orders back to Cin7?
4. **Purchase order sync**: Are Cin7 POs synced to CCW purchasing module?
5. **Stock adjustment sync**: When Cin7 adjusts stock, does CCW update?
6. **Branch/location**: Multi-location stock sync
7. **Price lists**: Multiple Cin7 price lists reflected in CCW
8. **Customer sync**: Cin7 customers ↔ CCW customers bidirectional
9. **B2B portal**: Cin7 B2B portal vs CCW customer portal — overlap?
10. **Reporting**: Cin7 built-in reports not surfaced in CCW dashboard

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-cin7.md`.
```

- [ ] **Step 3: Create shopify.md**

Create `.claude/agents/researchers/horizontal/shopify.md`:

```markdown
---
name: Shopify API Researcher
description: Audits Shopify API capabilities vs current CCW integration
---

# Shopify API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Shopify e-commerce platform
**Memory output**: `.claude/memory/enhancement-program/research/integrations-shopify.md`

## Scope

Current integration code:

- `apps/backend/src/api/routes/` — shopify.py, shopify_theme.py

Shopify API docs to fetch:

- https://shopify.dev/docs/api/admin-rest
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/product
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/order
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/inventory-item

## What to Look For

1. **Product sync**: Are all product fields (variants, metafields, images) synced?
2. **Order import**: Do Shopify orders flow into CCW orders automatically?
3. **Inventory sync**: Does CCW stock update Shopify inventory in real time?
4. **Fulfilment**: Does CCW dispatch trigger Shopify fulfilment?
5. **Returns**: Shopify refunds → CCW credit notes
6. **B2B**: Shopify B2B features for trade customers
7. **Abandoned carts**: Visibility of abandoned carts in CCW CRM
8. **Customer sync**: Shopify customers → CCW customers
9. **Discounts**: Shopify discount codes reflected in CCW orders
10. **Webhooks**: Which Shopify webhooks are active? What's missing?

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-shopify.md`.
```

- [ ] **Step 4: Create stripe.md**

Create `.claude/agents/researchers/horizontal/stripe.md`:

```markdown
---
name: Stripe API Researcher
description: Audits Stripe API capabilities vs current CCW integration
---

# Stripe API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Stripe payments platform
**Memory output**: `.claude/memory/enhancement-program/research/integrations-stripe.md`

## Scope

Current integration code:

- `apps/backend/src/api/routes/` — billing.py (Stripe billing)
- `apps/backend/src/api/routes/` — stripe_webhooks.py

Stripe docs to fetch:

- https://stripe.com/docs/api
- https://stripe.com/docs/payments/au-becs-debit (AU BECS Direct Debit)
- https://stripe.com/docs/billing/subscriptions/overview

## What to Look For

1. **AU BECS Direct Debit**: Is AU bank debit supported for recurring payments?
2. **Surcharging**: Does CCW pass Stripe fees to customers (legal in AU for B2B)?
3. **Payment links**: Stripe Payment Links for invoice payment
4. **Recurring billing**: Subscription billing for service retainers
5. **Refunds**: Stripe refund → CCW credit note workflow
6. **Disputes**: Stripe dispute management workflow
7. **Payout reconciliation**: Stripe payout ↔ bank reconciliation
8. **AU tax**: Is Stripe Tax configured for AU GST?
9. **Saved cards**: Customer saved payment methods
10. **Webhook coverage**: Which Stripe events trigger CCW actions?

## AU Compliance Checks

- Surcharging rules (ACCC — must not exceed cost of acceptance)
- Strong Customer Authentication equivalents in AU

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-stripe.md`.
```

- [ ] **Step 5: Create shipping-tbd.md**

Create `.claude/agents/researchers/horizontal/shipping-tbd.md`:

```markdown
---
name: Shipping & Stock Ordering Researcher
description: Audits the shipping/stock ordering platform integration (Starshipit or confirmed platform)
---

# Shipping & Stock Ordering Researcher

**Model**: claude-sonnet-4-6
**Domain**: Shipping and stock ordering platform (TBD — likely Starshipit or Shippit)
**Memory output**: `.claude/memory/enhancement-program/research/integrations-shipping.md`

## Platform Identification

First, determine which platform CCW uses:

1. Check `apps/backend/src/integrations/` for any shipping-related files
2. Check `apps/backend/src/api/routes/shipments.py` for any platform references
3. Search codebase: `grep -r "starshipit\|shippit\|auspost\|fastway\|couriers please" apps/`

If platform confirmed: fetch their developer docs.
If not confirmed: document as "Platform TBD" and note in findings that Phill needs to confirm.

## Starshipit docs (if confirmed):

- https://developers.starshipit.com/

## Shippit docs (if Shippit):

- https://developer.shippit.com/

## What to Look For

1. **Carrier integration**: Which carriers are supported? (AusPost, StarTrack, TNT, Toll, etc.)
2. **Label generation**: Auto-generate shipping labels from CCW dispatch
3. **Rate shopping**: Compare carrier rates at point of dispatch
4. **Tracking sync**: Real-time tracking events pushed to CCW shipments
5. **Customer notifications**: Auto SMS/email to customer with tracking link
6. **Returns portal**: Pre-paid return labels
7. **Address validation**: AU address validation at order entry
8. **Dangerous goods**: Dangerous goods declaration for cleaning chemicals
9. **Stock ordering**: If platform has stock ordering features, document them
10. **Reporting**: Freight cost reporting, carrier performance

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-shipping.md`.
Note platform name at top of file.
```

- [ ] **Step 6: Commit all horizontal researchers**

```bash
git add ".claude/agents/researchers/horizontal/"
git commit -m "feat(enhancement): add 5 horizontal researcher agent definitions — Phase 2"
```

---

### Task 4: Research Memory Files Initialisation

- [ ] **Step 1: Create all domain memory files with headers**

```bash
for domain in orders-quotes products-inventory customers-crm pos-reconciliation purchasing-suppliers warehouse-shipments ai-agents workshop-service settings-security integrations-xero integrations-cin7 integrations-shopify integrations-stripe integrations-shipping; do
  echo "# ${domain} Research Findings\n**Researcher**: ${domain}\n**Date**: —\n**Total findings**: 0\n\n_Awaiting research cycle_" > ".claude/memory/enhancement-program/research/${domain}.md"
done
```

- [ ] **Step 2: Verify all 14 files created**

```bash
ls ".claude/memory/enhancement-program/research/" | grep -v ".gitkeep" | wc -l
```

Expected: `14`

- [ ] **Step 3: Commit**

```bash
git add ".claude/memory/enhancement-program/research/"
git commit -m "feat(enhancement): initialise 14 research domain memory files — Phase 2"
```

---

### Task 5: Smoke Test — Researcher Swarm

- [ ] **Step 1: Verify all 14 agent files exist**

```bash
find ".claude/agents/researchers" -name "*.md" | grep -v FINDING-FORMAT | wc -l
```

Expected: `14`

- [ ] **Step 2: Verify all have required frontmatter**

```bash
grep -l "^---" .claude/agents/researchers/vertical/*.md .claude/agents/researchers/horizontal/*.md | wc -l
```

Expected: `14`

- [ ] **Step 3: Verify memory output paths match actual files**

```bash
# Each agent's memory output file should exist
grep -h "Memory output" .claude/agents/researchers/vertical/*.md .claude/agents/researchers/horizontal/*.md | sed 's/.*`//;s/`.*//' | while read path; do
  [ -f "$path" ] && echo "✅ $path" || echo "❌ MISSING: $path"
done
```

Expected: 14 lines starting with ✅

- [ ] **Step 4: Verify finding format file is readable**

```bash
wc -l ".claude/agents/researchers/FINDING-FORMAT.md"
```

Expected: > 30

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "test(enhancement): Phase 2 researcher swarm smoke test passing — 14 agents verified"
```

---

**Phase 2 complete when:** 14 researcher agent files exist, all have correct memory output paths, all memory files initialised.
**Next:** Phase 3 — Triage + Board + Linear
