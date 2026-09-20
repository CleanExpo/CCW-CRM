# Phase 2 Scope of Work

**Operational & Financial Reconciliation — Optix (CCW-CRM)**

Source file in this repo: [`CCW-Phase2-Scope-of-Work-v1.0-draft.docx`](./CCW-Phase2-Scope-of-Work-v1.0-draft.docx)  
Imported from `CCW_Phase2_Scope_of_Work (4).docx` (25 July 2026).

|                |                                                     |
| -------------- | --------------------------------------------------- |
| Client         | Carpet Cleaners Warehouse                           |
| Client Sponsor | Toby Bredhauer — Director & CEO                     |
| Product        | Optix (CCW-CRM)                                     |
| Depends on     | Phase 1 — Data Synchronisation Foundation           |
| Prepared by    | Rana Muzamil — Software Engineer / Product Engineer |
| Document date  | 25 July 2026                                        |
| Version        | **1.0 — Draft for client review and sign-off**      |
| Distribution   | Toby Bredhauer and nominated CCW stakeholders       |

**Status in this chat (20 Sep 2026):** Toby said this never reached a **signable v1.1**. This file is the July draft, not written approval. Open items in §15 are still client confirmation.

---

## Purpose of this document

This document defines the scope of Phase 2 of the Optix (CCW-CRM) project for Carpet Cleaners Warehouse. It sets out the objectives, deliverables, and acceptance criteria required to confirm that Optix produces the same operational and financial outcomes as Cin7. It is intended for review and written sign-off by Toby Bredhauer prior to development commencing.

Confidential — prepared for internal review between NuvanceX and Carpet Cleaners Warehouse.

## Contents

1. Project Overview
2. Guiding Principles
3. Phase 2 Objectives
4. Scope of Work — Order of Delivery
5. Reconciliation Areas in Detail
6. User Experience Improvements
7. System & Platform Enhancements
8. Integrations
9. Deliverables
10. Assumptions & Dependencies
11. Out of Scope
12. Acceptance Criteria & Exception Handling
13. Materiality & Risk Management
14. Expected Business Outcomes
15. Open Items for Client Confirmation
16. Next Steps
17. Document Control

---

## 1. Project Overview

Phase 1 delivered the foundation for this project: a resumable, transparent process for bringing Cin7's master data — products, customers, suppliers, branches and warehouses — into Optix, with clear reporting whenever something hasn't synced correctly. That foundation is now stable and in close-out.

Phase 2 moves from “does the data match” to “do the numbers match.” It is a structured, step-by-step validation that Optix produces the same operational and financial answers as Cin7 — stock on hand, stock value, sales totals, cost of goods sold, customer and supplier balances, and ultimately the figures reported in Xero.

The north-star outcome: for any agreed point in time, if Toby or Anne asks Optix for a stock valuation, a COGS figure, an inventory position, or a customer or supplier balance, Optix and Cin7 give the same answer.

This is deliberately not a phase for new features or workflows. It is a trust-building exercise, delivered area by area, with a formal sign-off at the end of each.

## 2. Guiding Principles

These principles apply across every reconciliation area and shape every decision made during Phase 2.

| Principle                     | What it means in practice                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cin7 is the source of truth   | Live Cin7 data is never changed simply to make numbers agree with Optix.                                  |
| Explain, don’t force          | Differences are investigated and explained, or formally recorded as an approved exception — never hidden. |
| Trust builds in stages        | Each reconciliation area is only started once the area before it has been signed off.                     |
| Outcomes over features        | Success is defined as matching answers, not new screens, reports, or workflows.                           |
| Faithful costing              | Optix represents Cin7’s FIFO costing outcomes rather than introducing an independent costing method.      |
| Phase 1 continues in parallel | The master-data Exception Report stays active until all Phase 1 items are closed or formally accepted.    |

## 3. Phase 2 Objectives

- Confirm Optix reproduces Cin7’s operational and financial outcomes — not just its raw data.
- Give the business a clear, evidence-based way to see and resolve differences, with nothing hidden or silently adjusted.
- Build confidence in stages, starting with stock quantities and progressing to full financial reconciliation with Xero.
- Preserve Cin7 as the single source of truth throughout the process.
- Represent Cin7’s FIFO costing faithfully in Optix, rather than building a separate costing engine.
- Produce a defensible, audit-ready evidence trail for every reconciled figure.

## 4. Scope of Work — Order of Delivery

Phase 2 is delivered as eight reconciliation areas, each building on the confidence established by the one before it. Every area concludes with a formal sign-off before the next begins. Areas 6 and 7 may run in parallel with Areas 2–4 for root-cause investigation, but sign-off always follows the sequence below.

| Order | Area                                             | Why it comes at this point                                                 |
| ----- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| —     | Phase 1 master-data close-out (parallel)         | Clean foundation; Exception Report stays active                            |
| 1     | Inventory quantities by warehouse                | The operational foundation everything else depends on                      |
| 2     | Inventory valuation (FIFO)                       | The financial stock position leadership asks for most often                |
| 3     | Sales invoices — pricing, discounts, GST, totals | Establishes commercial truth before costing is layered on                  |
| 4     | Cost of Goods Sold (COGS)                        | A key financial outcome, only reliable once invoices and stock are trusted |
| 5     | Customer & supplier balances                     | Builds on trusted invoice and purchasing records                           |
| 6     | Purchase orders & goods receipts                 | Confirms costing integrity flowing into stock and COGS                     |
| 7     | Inventory movements                              | Explains any remaining quantity or value differences                       |
| 8     | Xero financial reconciliation                    | The final, external check once Optix and Cin7 already agree                |

## 5. Reconciliation Areas in Detail

### Area 1 — Inventory Quantities by Warehouse

Confirm that stock on hand in Optix matches Cin7, at every warehouse and company-wide.

**What this covers**

- On-hand quantity by product (SKU) and warehouse.
- Warehouse-level and company-wide stock totals.
- Visibility into any stock still mid-sync, including transfers in progress.

**What “done” looks like**

- Every active product’s quantity matches Cin7 exactly, for every in-scope warehouse.
- Warehouse totals and the company-wide total tie out to Cin7.
- Any variance is logged with a clear reason and stays stable when the check is re-run.

### Area 2 — Inventory Valuation (FIFO)

Confirm the dollar value of stock in Optix matches Cin7’s FIFO valuation, by warehouse and in total.

**What this covers**

- Warehouse-level and total inventory asset value.
- Optix representing Cin7’s FIFO cost outcomes, rather than an independent costing calculation.
- A clear line of sight from quantity (Area 1) to cost basis to final valuation.

**What “done” looks like**

- Inventory valuation matches Cin7 for the agreed snapshot date, by warehouse and in total.
- Any variance is traceable to a quantity gap, a cost gap, or a documented approved exception.
- A quantity change without a matching cost update shows up as a visible exception, never silently.

### Area 3 — Sales Invoices

Confirm sales invoices in Optix match Cin7 for pricing, discounts, GST, and totals.

**What this covers**

- Invoice header details: customer, dates, status, currency.
- Line-level pricing, discounts, GST/tax, and line totals.
- Invoice-level subtotal, discount, GST, and grand total, across the agreed historical period.

**What “done” looks like**

- Every invoice in the agreed period exists in both systems, with matching totals.
- Header and line-level figures match Cin7, or are listed as clearly explained exceptions.
- No invoice exists in only one system without explanation.

### Area 4 — Cost of Goods Sold (COGS)

Confirm COGS in Optix matches Cin7 at period, invoice, and line-item level.

**What this covers**

- Period-level COGS totals for agreed accounting periods.
- Invoice-level and line-item COGS.
- Consistency with the FIFO valuation and movement data from Areas 2 and 7.

**What “done” looks like**

- Period, invoice, and line-item COGS all match Cin7, or exceptions are fully explained.
- COGS and closing inventory valuation tell a coherent, FIFO-consistent story — with no unexplained balancing figure.

### Area 5 — Customer & Supplier Balances

Confirm what customers owe and what is owed to suppliers matches Cin7.

**What this covers**

- Customer outstanding (AR) balances.
- Supplier outstanding (AP) balances.
- The invoices, bills, and credit notes driving each balance.

**What “done” looks like**

- Balances match Cin7 for every in-scope customer and supplier at the agreed as-of date.
- Any mismatch is traceable to a specific underlying document.
- Balances without matching documents, or documents without balance impact, are flagged and explained.

### Area 6 — Purchase Orders & Goods Receipts

Confirm purchasing and receiving activity matches Cin7, protecting the accuracy of costs that feed into stock value and COGS.

**What this covers**

- Purchase order identity, supplier, lines, quantities, costs, and status.
- Goods receipt quantities, costs, warehouse, and linkage back to the originating PO.
- The impact of receipts on stock quantity and value once posted.

**What “done” looks like**

- In-scope purchase orders match Cin7 on header and line commercial fields.
- Goods receipts match Cin7 for quantity, cost, warehouse, and PO linkage.
- Posted receipts affecting stock are reflected in Area 1/2 figures, or listed as exceptions.

### Area 7 — Inventory Movements

Explain and reconcile any remaining stock quantity or value differences through the underlying movement history.

**What this covers**

- Warehouse-to-warehouse transfers.
- Stock adjustments and stocktakes.
- Sales and purchase returns, where used by the business.

**What “done” looks like**

- In-scope movement types exist in Optix with matching Cin7 identity and key fields.
- Movements that change quantity or value are reflected in Areas 1, 2, or 4, or listed as exceptions.
- Unexplained quantity or value drift after this stage is zero, within the agreed materiality threshold.

### Area 8 — Xero Financial Reconciliation

Confirm inventory value and COGS agree across Cin7, Optix, and Xero for the agreed as-of period.

**What this covers**

- Inventory asset value in Xero compared against Cin7 and Optix.
- COGS in Xero compared against Cin7 and Optix, for each agreed period.
- Mapping between Optix/Cin7 accounts and the Xero chart of accounts.

**What “done” looks like**

- Inventory asset value and COGS agree across all three systems within materiality.
- Mapping issues are reported separately from genuine value mismatches.
- Remaining differences are either fixed in sync/logic or formally approved in writing by Toby.

## 6. User Experience Improvements

- An expanded Exception Report covering quantities, values, invoices, COGS, balances, and movements — not just master data.
- Clear “as of” snapshots for every reconciliation run, so results are always tied to a specific, agreed point in time.
- A simple, exportable evidence pack for each area, ready for client review without needing technical explanation.
- A short “same answer” verification pack covering the exact questions Anne and Toby ask most often — stock value, COGS, balances — so sign-off is fast and concrete.

## 7. System & Platform Enhancements

- Reuse of the resumable sync and completeness reporting built in Phase 1, extended to cover stock, invoices, purchases, and movements.
- A shared exception classification system so every difference is labelled consistently and reviewed the same way every time.
- A documented materiality policy, so minor rounding differences are never treated the same as genuine data gaps.
- A source-of-truth reference showing exactly which Cin7 report or API, and which Optix data, was compared for every area.
- Design that anticipates data volume — stock, movements, invoices, and purchases are processed in manageable, resumable batches.

## 8. Integrations

- **Cin7** — remains the authoritative source for all operational and inventory data throughout Phase 2.
- **Xero** — brought into scope at the final stage, to confirm inventory value and COGS agree across all three systems.
- No new third-party integrations are introduced in this phase; the focus is on strengthening what already connects Cin7, Optix, and Xero.

## 9. Deliverables

- Signed-off reconciliation results for each of the eight areas.
- An extended Exception Report covering operational and financial data.
- Stored “as of” reconciliation snapshots for audit and future reference.
- An agreed materiality policy, covering both quantity and dollar tolerances.
- A source-of-truth matrix mapping each area to its Cin7 and Optix data sources.
- A completed three-way reconciliation with Xero for inventory value and COGS.
- A short client-facing verification pack of “same answer” checks for Anne-style questions after each gate.

## 10. Assumptions & Dependencies

- Phase 1 master data (products, customers, suppliers, warehouses) is complete, or any gaps are formally accepted before a given area starts.
- Cin7 remains the source of truth; no live Cin7 data is changed to force agreement.
- Toby confirms materiality tolerances, the historical reconciliation window, and the in-scope warehouse list before development begins.
- The Xero chart of accounts in scope for Area 8 is agreed in advance.
- Each area is signed off before the next begins, in the order set out in Section 4.
- Multi-currency handling is out of scope unless confirmed that CCW uses it in Cin7 (default assumption: AUD only).

## 11. Out of Scope

- New ERP features or operational workflows unrelated to reconciliation.
- Cleaning or modifying live Cin7 data to make numbers agree.
- An independent Optix costing engine (average cost, last cost) separate from Cin7’s FIFO method.
- Full Xero bookkeeping takeover, bank reconciliation, or POS cash-up.
- Shopify or other sales channel expansion, unless required to complete a specific reconciliation gate.
- New procurement approval workflows or supplier performance analytics.
- Full credit-control workflows or payment allocation interfaces beyond what reconciliation requires.

## 12. Acceptance Criteria & Exception Handling

An area is considered complete when all of the following are true:

- Optix produces the same operational or financial result as Cin7, for the agreed scope and point in time.
- Any differences are listed, classified, and clearly explained — never left as unexplained drift.
- Differences are resolved through sync or logic improvements, never by editing live Cin7 data.
- Results are repeatable — re-running the same check at the same as-of produces the same outcome.
- Any remaining variance is within the materiality tolerance agreed with Toby, or formally approved in writing.

### How differences are classified

| Classification    | What it means                                                   |
| ----------------- | --------------------------------------------------------------- |
| Missing in Optix  | Exists in Cin7 but hasn’t appeared in Optix yet.                |
| Extra in Optix    | Exists in Optix but not in Cin7.                                |
| Value mismatch    | The same record exists in both systems with a different figure. |
| Timing            | Explained by cut-off timing or a transaction still in progress. |
| Mapping           | A tax, warehouse, contact, or GL account mapping issue.         |
| Approved variance | Reviewed and formally accepted by Toby.                         |
| Skipped on sync   | A known, documented exclusion from the current sync.            |

## 13. Materiality & Risk Management

### Materiality policy

A materiality threshold prevents trivial rounding noise from being treated as a genuine data problem. Recommended defaults, to be confirmed by Toby before Area 1 begins:

- Quantity tolerance: exact match (zero variance).
- Dollar tolerance: $0.01 (AUD), unless otherwise agreed.

### Key risks and how they are managed

| Risk                                   | Why it matters                                     | How it’s managed                                                               |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Phase 1 master-data gaps still open    | Creates noisy, unreliable results early in Phase 2 | Keep the Exception Report active; agree a residual allow-list before each gate |
| Ambiguous “point in time”              | Leads to ongoing disputes over what should match   | Lock down as-of rules before Area 1 begins                                     |
| Re-building FIFO incorrectly           | Risk of wrong valuation or COGS figures            | Mirror Cin7’s FIFO outcomes rather than recalculating independently            |
| Starting Xero reconciliation too early | Produces false failures and wasted effort          | Xero work only starts once Areas 2 and 4 are signed off                        |
| Scope creep into new features          | Delays the core trust-building outcomes            | Any expansion beyond reconciliation requires Toby’s sign-off                   |
| In-transit / timing stock differences  | Can look like a genuine quantity mismatch          | Clear timing classification and agreed freeze windows                          |
| Rounding & GST differences             | Ongoing small-dollar noise                         | Document rounding rules and agree materiality upfront                          |

## 14. Expected Business Outcomes

- Leadership can trust Optix numbers for day-to-day decisions without cross-checking Cin7.
- Stock, sales, and margin questions get fast, consistent answers from a single system.
- Any future discrepancy is quickly identified and explained rather than causing uncertainty.
- A clear, audit-ready trail supports finance and compliance conversations.
- A proven foundation for confidently expanding Optix further down the line.

## 15. Open Items for Client Confirmation

Before development starts, we need Toby’s confirmation on the following:

- Exact quantity and dollar materiality tolerances.
- How far back historical invoices, movements, and purchase orders need to reconcile.
- The full list of warehouses in scope, or any exclusions.
- The specific “same answer” questions or reports that define success for Anne.
- Which Xero accounts must agree as part of Area 8.
- How credit notes and returns should be treated in the invoice, COGS, and movement areas.
- Target date for Phase 2 kickoff.

## 16. Next Steps

- Toby to confirm materiality tolerances, historical window, warehouse list, and in-scope Xero accounts.
- Written approval of this scope document.
- Kick-off of Area 1 — Inventory Quantity Reconciliation.

## 17. Document Control

| Version | Date         | Prepared by  | Notes                                                                                                   |
| ------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------- |
| 1.0     | 25 July 2026 | Rana Muzamil | Initial detailed Phase 2 scope, prepared from agreed client direction (including FIFO costing approach) |

Next step: client review and written approval of this scope, then implementation begins at Area 1.
