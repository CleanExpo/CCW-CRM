# Backend God-File Analysis — April 2026

**Ticket:** UNI-1930 / UNI-1931  
**Date:** 2026-04-19  
**Scope:** `apps/backend/src/` — excludes `demo_models.py` (locked)

---

## Top-3 Backend God Files by Line Count

| Rank | File                                 | Lines | Domain                                |
| ---- | ------------------------------------ | ----- | ------------------------------------- |
| 1    | `api/routes/inventory.py`            | 2,196 | Inventory CRUD + stock-take + reorder |
| 2    | `api/routes/integrations/shopify.py` | 1,943 | Shopify sync + webhooks               |
| 3    | `api/routes/orders.py`               | 1,268 | Order CRUD + fulfilment               |

Cin7 GL integration (`api/routes/integrations/cin7_gl.py`, 1,108 lines) was selected as C1.2 split target (see below) due to clear domain boundaries and lower risk than CRUD modules.

---

## Selected Split Target: `cin7_gl.py` (1,108 lines)

**Why this file:**

- Clear 3-domain structure: Chart of Accounts, Journal Entries, Account Mappings
- All demo data and schemas co-located with routes (single-file antipattern)
- No downstream callers outside `main.py` — safe to restructure
- Existing structural tests (`test_webhook_idempotency.py` pattern) are pure-Python — no DB dependency

**Proposed modules:**

| Module                    | Contents                                              | Est. lines |
| ------------------------- | ----------------------------------------------------- | ---------- |
| `cin7_gl_schemas.py`      | Demo data fixtures + Pydantic request/response models | ~400       |
| `cin7_gl_coa.py`          | Chart of Accounts endpoints (list + sync)             | ~140       |
| `cin7_gl_journals.py`     | Journal Entries endpoints (list + create + post)      | ~400       |
| `cin7_gl_mappings.py`     | Account Mappings endpoints (list + upsert)            | ~145       |
| `cin7_gl.py` (aggregator) | Thin router that `include_router`s all three above    | ~15        |

**Public API contract:** unchanged — `main.py` still imports `cin7_gl.router`, which retains prefix `/api/cin7` and all 7 endpoints at the same paths.

**`demo_models.py`:** explicitly excluded — locked file, zero changes.

---

## Remaining God Files (future sprints)

| File           | Lines | Proposed split strategy                                       |
| -------------- | ----- | ------------------------------------------------------------- |
| `inventory.py` | 2,196 | Split by domain: products, stock-take, reorder-rules, barcode |
| `shopify.py`   | 1,943 | Split by domain: products, orders, webhooks, inventory        |
| `orders.py`    | 1,268 | Split: orders CRUD, order items, order status/fulfilment      |

---

_Plan approved and executed as part of UNI-1931._
