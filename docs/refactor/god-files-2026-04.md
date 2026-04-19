# Backend God-File Split Plan — 2026-04

**Ticket:** UNI-1930 (C1.1)
**Date:** 2026-04-19
**Reviewer:** tech lead (pending)
**Rule:** no code change in this ticket — plan only. Each target gets a
dedicated split ticket that links back here.

---

## Executive summary

Three backend files, totalling **6,212 lines**, materially exceed the
team's 400-line-per-module ceiling and are the prime candidates for
splitting.

| Rank | File                                                  | Lines | Shape                                                             |
| ---- | ----------------------------------------------------- | ----: | ----------------------------------------------------------------- |
| 1    | `apps/backend/src/api/routes/inventory.py`            | 2,507 | 33 routes across 8 inventory domains + 30 inline Pydantic classes |
| 2    | `apps/backend/src/api/routes/integrations/shopify.py` | 2,017 | 29 routes across 6 explicit section-comment divisions             |
| 3    | `apps/backend/src/db/inventory_schemas.py`            | 1,688 | 58 Pydantic schemas — currently orphaned (zero imports in src/)   |

`demo_models.py` is intentionally excluded — it's a locked file.

---

## Methodology

1. `find apps/backend/src -name "*.py" -not -path "*/__pycache__/*"` →
   line-count sort descending.
2. Exclusions: `demo_models.py` (locked), `tests/`, `.venv/`, generated
   files, `__init__.py`.
3. Structure mapped by reading enough of each file to see the module
   surface area (route count, inline classes, section comments).
4. **Radon not installed** in the project venv — cyclomatic complexity
   analysis deferred. To enable: `cd apps/backend && uv add --dev radon`
   then `uv run radon cc src/ -s -n B`. This plan uses line count +
   qualitative structure only; CC numbers can be added in a follow-up.

---

## Target 1 — `api/routes/inventory.py`

**Current state**

- 2,507 lines, 33 FastAPI route handlers, 30 inline Pydantic request/response classes.
- Covers 8 distinct inventory domains (stock levels, transfers, adjustments, reservations, location management, stocktakes, bin locations, serial/lot tracking).
- Imported by `src/api/main.py` as `from .routes.inventory import router`.

**Proposed split** — one router per domain, all re-exported from a new
`inventory/` package so the main.py import stays stable:

```
apps/backend/src/api/routes/inventory/
├── __init__.py          # re-exports aggregated `router`
├── stock_levels.py      # GET/POST stock, current availability
├── transfers.py         # inter-location transfers
├── adjustments.py       # write-offs, corrections
├── reservations.py      # allocate/release stock
├── locations.py         # warehouse/location CRUD
├── stocktakes.py        # cycle counts + variance
├── bin_locations.py     # bin/shelf management
└── serial_lot.py        # serial + lot tracking
```

Pydantic schemas move with their owning route, OR are consolidated into
`db/inventory_schemas.py` if reused (see Target 3).

**Risks**

- 33 routes means 33 endpoint paths that must not change. An integration
  test + `grep -r "/api/inventory"` check is required in the split PR.
- Imported by several AI agents (`agents/stock_agent.py` — check).
- Preserve the router prefix and dependencies exactly.

**Effort:** **L** (6–8 hours of careful cuts + tests).

**Follow-up ticket:** _refactor(inventory): split inventory.py router
into 9-module package — UNI-1930-A_.

---

## Target 2 — `api/routes/integrations/shopify.py` ⭐ RECOMMENDED FIRST

**Current state**

- 2,017 lines, 29 FastAPI route handlers, 6 explicit section-comment
  dividers (`# Connection Management Endpoints`, `# Order Import
Endpoints`, `# Inventory Sync Endpoints`, etc.).
- Import surface: `main.py` imports `router` from this file.

**Why recommended first**

1. The code already announces its own seams — the section comments are
   the split plan. Minimal judgement-call required.
2. 29 routes are organised into 6 natural groups of 3–6 routes each.
3. Risk of import-path breakage is lower because Shopify routes are only
   consumed by the Shopify frontend tile, not by AI agents.

**Proposed split**

```
apps/backend/src/api/routes/integrations/shopify/
├── __init__.py          # aggregated router
├── connection.py        # OAuth connect/disconnect
├── order_import.py      # order webhook + import
├── inventory_sync.py    # stock push/pull
├── product_sync.py      # catalog sync
├── fulfilment.py        # fulfilment create/update
└── admin.py             # reset/diagnostic/admin tools
```

**Risks**

- Shopify webhook handlers must keep their exact paths — any rename
  would break the Shopify app registration.
- Shared helpers (HMAC validation, the Shopify client singleton) move
  to a new `shopify/_helpers.py`.

**Effort:** **M** (4–5 hours).

**Follow-up ticket:** _refactor(shopify): split shopify.py router into
7-module package — UNI-1930-B_.

---

## Target 3 — `db/inventory_schemas.py`

**Current state**

- 1,688 lines, 58 Pydantic classes.
- **Zero imports anywhere in `apps/backend/src/`**. Confirmed via
  `grep -r "from src.db.inventory_schemas" apps/backend/src/` → empty.
- Likely superseded by inline Pydantic classes in `inventory.py` (see
  Target 1) but never deleted.

**Proposed action — pre-split audit**

1. Run `uv run vulture apps/backend/src/db/inventory_schemas.py
--min-confidence 80` to confirm dead-code status.
2. If confirmed dead → **delete** (not split). This is a cleanup, not a
   refactor.
3. If it turns out to be a canonical schema set that inventory.py
   SHOULD import (to remove the 30 inline classes in Target 1), then
   the "split" is actually consolidation: make inventory.py's routes
   import from here.

**Effort:** **S** (~1 hour, mostly the vulture run + commit).

**Follow-up ticket:** _refactor(schemas): delete or consolidate
inventory_schemas.py (1,688 lines, zero current imports) —
UNI-1930-C_.

---

## Split order recommendation

**Tackle in this order:** 2 (shopify) → 3 (schemas audit) → 1 (inventory).

- Shopify is the lowest-risk, highest-structure-already-present win.
- Schemas file is quick — either deletion or consolidation, both small.
- Inventory is the biggest and benefits from the patterns learned in
  Shopify. Don't do it first.

---

## Appendix — top 20 Python files by line count (backend, excluding locked)

```
2507  apps/backend/src/api/routes/inventory.py
2017  apps/backend/src/api/routes/integrations/shopify.py
1688  apps/backend/src/db/inventory_schemas.py
 (remaining 17 entries regenerate via:
  find apps/backend/src -name "*.py" -not -path "*/__pycache__/*" \
       -not -name "demo_models.py" | xargs wc -l | sort -n | tail -20)
```

Any follow-up work should regenerate this list first — line counts drift.

---

_Plan only. No code changes in UNI-1930. Next: open UNI-1930-A / -B / -C
from the titles above, with this doc linked as the source of truth._
