# Task Brief

[HIGH] [Warehouse] Add serial number and lot/batch tracking — Phase 1: schema and migration

Description:
## What's missing

No serial number or lot/batch tracking exists. Cleaning equipment and consumables requiring WHS lot traceability (recall capability) have no traceability from purchase receipt through to sale. Warranty lookups by serial number are impossible.

**CTO phased delivery:** Phase 1 = schema + migration only. Phase 2 = UI, reports, and serial-based service history in workshop.

## Business impact

Without serial tracking, product rec… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/db/inventory_models.py
supabase/migrations/  # new migration for serial/lot tables
apps/backend/src/api/routes/inventory.py
```

**Goal:** New tables inventory_serials and inventory_lots exist with proper FKs + RLS; migration applied; read API returns rows.

**Verify (runnable):**

```
1. Supabase MCP: list_tables confirms both tables present.
2. cd apps/backend && uv run pytest tests/api/test_inventory.py -k serial_lot
3. UI: /inventory/[sku] → 'Serials' tab renders empty state without error.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1823 — https://linear.app/unite-group/issue/UNI-1823/warehouse-add-serial-number-and-lotbatch-tracking-phase-1-schema-and
Triggered automatically by Pi-CEO autonomous poller.


## Session: 050c527206c5
