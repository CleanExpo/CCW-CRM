# CCW-Online ERP

## Overview

**CCW-Online ERP** is an integrated **ERP and CRM** platform for **equipment suppliers**—wholesalers and distributors who need one place to run sales, operations, and customer relationships instead of stitching together spreadsheets, inboxes, and separate point tools.

The product is designed around the **quote-to-cash** lifecycle: knowing what you sell, who you sell to, how you price and quote, how orders move through fulfilment, and how activity ties back to stock, purchasing, and finance. Documentation positions it as a **hub** that can connect to inventory, accounting, e‑commerce, and other systems you already use, so data flows with the business rather than being re-keyed at every hand-off.

Product materials highlight a strong fit for **Australian cleaning-equipment** wholesalers and distributors. The same structure applies to **broader equipment-supply** businesses that share similar workflows: SKU-led catalogues, B2B quoting, warehouse-aware fulfilment, and finance reconciliation.

---

## Problems this platform is meant to solve

- **Fragmented work** — Teams lose time when customer history, stock picture, and order status live in different places.
- **Quote-to-order errors** — Misaligned pricing, product, or customer data creates rework and disputes.
- **Weak visibility** — Leadership and frontline staff struggle to see what is selling, what is stuck, and what needs attention.
- **Integration debt** — Accounting, inventory, and online channels only deliver value when they stay in sync with day-to-day operations.

CCW-Online ERP is intended to **narrow those gaps** by keeping core commercial and operational data in one system and by **documenting integrations** (inventory bridges, accounting, e‑commerce, payments, and AI-related services) as first-class capabilities—understanding that **maturity varies by module** and is reflected honestly in internal docs and roadmaps.

---

## Capabilities (by business area)

The following reflects **documented product intent** across user guides, catalogs, and architecture notes. Not every capability is equally complete in every deployment; see the [documentation index](docs/README.md) and [Product overview](docs/PRODUCT-OVERVIEW.md) for depth and status.

### Sales and customer relationship management

- **Customer and contact records** tied to quotes, orders, and activity.
- **Quotes** with lifecycle status and paths to convert into orders.
- **Orders** and pipeline concepts that connect to fulfilment and billing themes.
- **Dashboards and reporting** for high-level KPIs, recent activity, and entry points into daily work.

### Products and catalogue

- **SKU-led catalog** with pricing, categories, and search—aligned to how equipment suppliers actually sell (kits, variants, and commercial pricing).

### Inventory, procurement, and warehouse

Documentation describes **inventory**, **purchase orders**, **receiving**, **stock movements**, **transfers**, and **reorder** concepts—supporting the reality that distributors live in stock, not only in CRM screens.

### Finance and reconciliation

Themes include **invoicing**, **reconciliation**, and **accounting-system alignment** (for example **Xero**-style flows in integration docs), so finance teams can close the loop between operational truth and the general ledger.

### Customer service and field-style work

**Service requests**, **activities**, and **workshop or equipment-oriented** journeys appear in training and persona materials—supporting teams that repair, install, or support equipment as well as those who only sell it.

### Integrations (connected business)

Internal catalogs reference connections such as **inventory / ERP bridges** (e.g. Cin7-oriented flows), **accounting** (Xero), **e‑commerce** (Shopify), **payments**, and **AI / media** providers. Treat integration lists as a **capability map**: some paths are production-ready, others partial or gated—details sit in `docs/catalogs/` and integration guides.

### AI-assisted workflows

Documentation describes **AI and agent-style** features to reduce repetitive work and support decisions in domains like inventory, quotes, and operations. Adoption and in-product discoverability are called out as ongoing product themes—not only raw technical capability.

### Internationalisation and content

**i18n** guides and marketing-style content exist to support **multi-language** and **go-to-market** needs alongside the core application.

### Operations, security, and reliability

Runbooks and audits cover **deployment**, **monitoring**, **backups**, **disaster recovery**, **secrets**, and **security**—reflecting an intent to run as a **serious production system**, not a one-off demo.

---

## Who benefits

| Audience                     | How they benefit                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **Sales and account teams**  | Faster, more accurate quotes; clearer customer and order context.                |
| **Operations and warehouse** | Better alignment between what was promised, what is in stock, and what ships.    |
| **Finance**                  | Cleaner hand-off to accounting and reconciliation workflows.                     |
| **Customer service**         | Shared history and service workflows so issues do not start from zero each time. |
| **Leadership**               | More consistent data for decisions on margin, fulfilment, and growth.            |

---

## Goals (what “good” looks like)

Internal documentation repeatedly points to outcomes such as:

- **Reliable quote-to-cash** — Fewer broken hand-offs between quote, order, and fulfilment.
- **Integration value** — Inventory, commerce, and accounting links used in real processes, not only as toggles.
- **Operational readiness** — Monitoring, backups, and security practices suitable for real customers and auditors.
- **User productivity** — Role-appropriate onboarding and shorter **time-to-productivity** for new staff.
- **Trust and scale** — Role-based access, auditability, and patterns that support a growing customer base.

---

## Documentation in this repository

| Resource                                         | Purpose                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **[Documentation index](docs/README.md)**        | Start here: guides, runbooks, API notes, security, deployment, and feature references. |
| **[Product overview](docs/PRODUCT-OVERVIEW.md)** | Business-focused summary of scope, strengths, and documented gaps.                     |
| **[docs/project-root/](docs/project-root/)**     | Legacy and scratch notes from earlier project phases (traceability and deep links).    |

For **database**, **API**, and **catalog** specifics, use the index above—those files change as the product evolves.

---

## Running the application locally

Contributors and engineers can run the app from the repository root:

```bash
npm install
npm run dev
```

Environment variables are described in **[`.env.example`](.env.example)** (including separate backend and frontend files where applicable). For test commands, backend setup, and hosting notes, follow **`docs/README.md`**.
