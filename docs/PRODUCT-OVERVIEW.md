# CCW-Online ERP — Product Overview

**Audience:** Leadership, product, customer success, and new engineers  
**Intent:** Business-focused summary of what the product is, what it aims to achieve, what documentation says is built, and what still needs work  
**Sources:** `README.md`, `docs/README.md`, `docs/project-root/CLAUDE.md`, user and training docs, gap analyses, PRDs, phase summaries, integration and page/route catalogs, and independent audit notes  

**Note on paths:** Some catalogs and audits refer to folders such as `apps/web` and `apps/backend`. The contributor guide also describes a **single package at the repo root** with the App Router under `src/app/`, and optional backend work under `backend/`. Treat path names as **documentation anchors**; your checkout may use the root `src/` layout described in `README.md` and `docs/project-root/CLAUDE.md`.

---

## 1. Executive summary

**CCW-Online ERP** is positioned as a **full-stack ERP and CRM for equipment suppliers**, with a strong fit for **Australian cleaning-equipment** wholesalers and distributors. It brings together **product catalog, customers, quotes, orders, inventory and procurement themes, finance hooks, integrations (inventory, accounting, e‑commerce), and AI-assisted workflows**—plus a large body of **training, operations, and compliance documentation**.

Documentation and internal audits describe a **broad, ambitious platform** (dozens of UI areas, hundreds of API endpoints, many integrations). At the same time, **structured gap analyses and third-party-style reviews** record **substantial follow-up work** in areas such as **end-to-end consistency between screens and APIs**, **test coverage**, **onboarding and discoverability of AI features**, and **production hardening** (security, CI discipline, and mobile flows).

---

## 2. Business purpose and vision

### 2.1 Purpose

- **Unify** sales, operations, warehouse, finance, and customer-facing workflows in one system instead of disconnected spreadsheets and tools.
- **Support equipment-supplier operations**: SKU-led catalog, stock and location concepts, quotes-to-cash, purchasing and receiving, and reconciliation with external systems.
- **Serve teams** across roles: sales, warehouse, finance, customer service, workshop-style service, and administrators (see training persona work in `docs/training-audit-2026-03-24/`).

### 2.2 Vision (as reflected in documentation)

- **Operational clarity:** Dashboards, reports, alerts, and monitoring so leaders see health and bottlenecks.
- **Connected business:** Deep links to **inventory (Cin7-style)**, **accounting (Xero)**, **e‑commerce (Shopify)**, payments (e.g. Stripe), and AI providers—so the ERP is a **hub**, not another silo.
- **Smarter work:** Many documents describe **AI agents**, copilots, forecasting, and automation—not as a single chat box only, but as **embedded assists** in daily tasks (quotes, inventory, service, etc.).
- **Trust and scale:** RBAC, audit concepts, security runbooks, disaster recovery, and production runbooks point toward **multi-tenant SaaS-style** expectations (see `docs/RBAC-DESIGN.md` and security/operations docs under `docs/`).

---

## 3. Key features and functionality

The following is synthesized from **user guide** (`docs/user-guide/USER_GUIDE.md`), **catalogs** (`docs/catalogs/`), and **architecture notes in `docs/`**. It is **not** a guarantee that every item is complete or exposed in every deployment; it reflects **documented product intent**.

### 3.1 Core ERP / CRM (day-to-day operations)

| Area | User-facing value (documentation) |
|------|-------------------------------------|
| **Authentication & profiles** | Sign-in, onboarding concepts, password change, role-based usage. |
| **Dashboard & analytics** | High-level KPIs, recent activity, entry points into work. |
| **Products** | Catalog, SKU, pricing, categories, stock and location concepts, search and filters. |
| **Customers & contacts** | Customer records, relationship to orders/quotes, activities. |
| **Quotes** | Create, send, convert to orders, lifecycle status. |
| **Orders** | Order pipeline, status, linkage to fulfilment and billing themes. |
| **Reports & insights** | Reporting and AI/insights-style pages in route maps. |

### 3.2 Inventory, procurement, and warehouse (supplier reality)

- **Inventory, purchase orders, receiving (GRN), stock take, transfers, reorder logic**—described in user journeys and integration docs (e.g. Cin7-related routes and warehouse quick-starts).
- **Supplier and shipment** themes appear in documentation and gap/verification trackers.

### 3.3 Finance and reconciliation

- **Invoices, POS reconciliation, bank feeds, Xero**—reflected in integration summaries and persona-based training docs (finance officer journey).
- **Tax, billing, and dunning** concepts appear in **gap remediation** and service-layer planning (not only in UI copy).

### 3.4 Customer service and field/service flavour

- **Service requests, activities, email-oriented flows**—covered in personas and module lists.
- **Workshop / equipment / bookings** themes appear in training persona scope (depth varies by doc date).

### 3.5 Integrations (documented breadth)

`docs/catalogs/INTEGRATIONS.md` and architecture tables summarize **third-party systems**, including (non-exhaustive):

- **Inventory / ERP bridge:** Cin7 (documented as multi-phase, broad surface area).
- **Accounting:** Xero (OAuth, invoices, bank feeds, reconciliation themes).
- **E‑commerce:** Shopify (sync, webhooks; docs note blockers/auth follow-up).
- **AI / media:** Google AI, OpenAI-style agents, image/avatar pipelines in broader docs.
- **Payments, video, voice, and devops-adjacent hooks** appear in architecture and skills docs.

*Status labels in catalogs vary (“complete”, “partial”, “blocked”); treat integration lists as **roadmap + capability map**, not a certification.*

### 3.6 AI, automation, and “agentic” capabilities

- **Agentic layer** documentation (`docs/AGENTIC_LAYER_IMPLEMENTATION.md`) describes **self-review loops, memory, orchestration**, and agent-style automation themes aligned to business domains (inventory, security, performance, etc.).
- **Training audit** notes that **many agents exist** but **end-user adoption and discoverability** are weak without UI entry points and training—i.e. **capability exists on paper** but **productization** is an ongoing theme.

### 3.7 Internationalization and content

- **i18n** guides and demo material exist (`docs/I18N-DEMO-GUIDE.md` and related).
- **Marketing/content** docs (blogs, campaigns) live under `docs/content/`—supporting **go-to-market**, not only the app shell.

### 3.8 Operations, reliability, and governance

Document sets cover **deployment**, **cron jobs**, **monitoring**, **disaster recovery**, **secrets**, **load and performance**, **security audits**, and **incident response**. These position the product as something meant to run **seriously in production**, not only as a demo.

---

## 4. Goals and objectives (what success looks like)

Documentation repeatedly points to these **business-level objectives**:

| Theme | Stated or implied goals |
|-------|-------------------------|
| **Quote-to-cash reliability** | Stable quotes and orders with fewer errors and failed API interactions (see deployment roadmap and gap EPICs). |
| **Integration value** | Inventory, Shopify, and accounting connections **actually used in production**, not only demo toggles. |
| **Operational readiness** | Monitoring, backups, runbooks, and security practices suitable for real customers. |
| **Quality and maintainability** | Type-safe contracts between UI and API, tests that truly gate releases, and honest CI (see gap phases and audit notes). |
| **User productivity** | Role-specific onboarding; **time-to-productivity** targets (training audit proposes **~3 days** vs **~2 weeks**); surfacing AI features in-product. |
| **Scale and trust** | RBAC, audit trails, and tenant-aware patterns for a growing customer base. |

---

## 5. What documentation indicates is already implemented

This section reflects **written completion reports, catalogs, and guides**—**not** a live production audit of your environment.

### 5.1 Application surface area

- **Large UI footprint:** Page catalogs on the order of **~99 pages** (per `docs/catalogs/PAGES.md`, dated 2026-03).
- **Large API footprint:** Route catalogs report on the order of **~115 route files** and **hundreds of endpoints** (per `docs/catalogs/ROUTES.md`).
- **Integration modules:** Catalog lists **many** integration areas with file-level pointers (Cin7, Xero, Shopify, Google AI, etc.).

### 5.2 Data and demo realism

- **Product catalog seed concepts** tie generic categories to **cleaning-equipment SKUs** and Australian-style customer examples (`docs/research/ccw-product-catalog-raw.md`).
- **Phase-style reports** (e.g. Phase 8 integration testing summary) describe **migrations, tests, and API alignment** work completed in those phases—useful as evidence of **engineering progress**, not end-user certification.

### 5.3 AI / engineering systems

- **Agentic infrastructure** (prompting, feedback loops, memory patterns) is documented as **implemented and tested** to a point, with **hardening** called out as follow-up (`docs/AGENTIC_LAYER_IMPLEMENTATION.md`).
- **Developer experience:** Tooling and scripts in-repo support **fast, repeatable delivery**—this is **delivery capability**, not end-user feature parity.

### 5.4 User-facing documentation

- **End-user guide** for core modules (products, customers, orders, quotes) exists (`docs/user-guide/USER_GUIDE.md`).
- **Role quick-starts** were produced under training-audit work (sales, warehouse, finance, etc.)—addressing the earlier “one generic manual” problem at the **content** level.

---

## 6. What is pending, at risk, or needs improvement

Treat this as a **prioritized backlog narrative** drawn from **gap reports, PRDs, and independent audits**—not an accusation about today’s build.

### 6.1 Structural product gaps (cataloged)

- **Gap remediation summary** (`docs/gaps/SUMMARY-REPORT.md`) cataloged **95 gaps** with a multi-phase plan (types → APIs → services → UI polish → tests). **Critical items** cluster around **contracts, endpoints, and business services** before polish scales.
- **Sprint-style PRD** (`docs/PRD-CCW-GAPS-2026-03-24.md`) lists **front/back mismatches** examples (e.g. cron router registration, missing pages for contractors/service requests/bank feeds, AI compliance, search blocked on schema).

### 6.2 Production and security concerns (audit-style)

The **principal swarm review** (`docs/swarm-review-2026-03-24/00-master-synthesis.md`) raises **severe** themes if still present in your branch:

- **Access control:** Claims that **dashboard routes** could be insufficiently protected and **backend auth shortcuts** could exist—**must be verified** on current code and re-mediated for any customer-facing environment.
- **Mobile / guest flows:** **Incomplete approval workflow** (e.g. payment, order creation, email) and **incorrect base URLs** in some flows—**customer trust** issue.
- **CI honesty:** **Tests or migrations allowed to fail** while CI stays green—**organizational risk**, not only a technical nit.
- **Performance / UX resilience:** Disabled caching on hot paths, missing global error/404/loading patterns, mobile viewport issues—**affect perceived quality and support cost**.

*Any audit is **point-in-time**; use it as a **checklist**, then re-verify.*

### 6.3 Training, adoption, and “hidden” value

- **Single generic training path** → **role confusion** and slow ramp (training audit executive summary).
- **AI features** reportedly **under-adopted** because they are **not surfaced** in obvious UI patterns.
- **90-day roadmap** (`docs/training-audit-2026-03-24/08-90-day-roadmap.md`) tracks **content**, **in-app discovery**, and **measurement**—mostly **not** “done” from checkbox perspective.

### 6.4 Deployment and infrastructure (roadmap docs)

- Early **deployment roadmap** items (`docs/DEPLOYMENT_ROADMAP_SUMMARY.md`) called out **infrastructure provisioning**, **SSL**, **load balancing**, **secrets**, and **hardening** as **blocking** themes for a hard go-live date. Later docs may supersede—**reconcile dates** when planning.

### 6.5 Documentation and repository drift

- **Catalog path conventions** (`apps/web`, `apps/backend`) may **not** match a **root `src/`** layout in every branch. **When in doubt, trust `README.md` and `docs/project-root/CLAUDE.md` for the checkout you are in**, and update catalogs when structures change.

---

## 7. How to use this document with the rest of `docs/`

| If you need… | Start with… |
|--------------|-------------|
| **End-user language** | `docs/user-guide/USER_GUIDE.md` |
| **What screens exist (inventory)** | `docs/catalogs/PAGES.md` |
| **What APIs exist (inventory)** | `docs/catalogs/ROUTES.md`, `docs/api/` |
| **Integrations story** | `docs/catalogs/INTEGRATIONS.md`, `docs/README.md` |
| **Backlog narrative** | `docs/gaps/SUMMARY-REPORT.md`, `docs/PRD-CCW-GAPS-2026-03-24.md` |
| **Risk / readiness tone** | `docs/swarm-review-2026-03-24/00-master-synthesis.md`, `docs/security/SECURITY_AUDIT_SUMMARY.md` |
| **Onboarding strategy** | `docs/training-audit-2026-03-24/00-training-audit-overview.md` |
| **Run production** | `docs/PRODUCTION_RUNBOOK.md`, `docs/deployment/DEPLOYMENT-RUNBOOK.md`, `docs/DISASTER_RECOVERY.md` |

---

## 8. Closing note

CCW-Online ERP, **as documented**, is a **wide product**: ERP/CRM core, deep integration, AI-augmented workflows, and serious operations documentation. **Delivery reality**—especially **security, CI discipline, UI/API parity, training, and integration completion**—is best tracked through the **gap and audit artifacts** cited above, refreshed on a regular cadence as the codebase evolves.

When presenting to stakeholders, separate three lenses:

1. **Vision and scope** (what we sell and build toward).  
2. **Documented engineering footprint** (breadth of screens, services, and integrations).  
3. **Hardening and adoption** (what blocks confident rollout and daily user success).

This overview is **derived from internal docs**; it should be **validated** against the **current branch**, **environment**, and **business priorities** before external commitments.
