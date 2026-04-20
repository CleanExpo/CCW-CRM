# Task Brief

[HIGH] [Shipping] Add dangerous goods declaration for cleaning chemicals — ADG Code compliance

Description:
## What's missing

CCW supplies cleaning chemicals (hazardous goods under the Australian Dangerous Goods Code). Shipments containing DG items have no declaration, DG class labelling, or UN number capture. Carriers legally cannot accept undeclared dangerous goods.

**Condition (COO):** This issue is blocked by [UNI-1822](https://linear.app/unite-group/issue/UNI-1822/shipping-build-multi-carrier-api-abstraction-layer-auspost-tnt-fedex) (carrier API). DG declarations must be passed to the carrier API as part… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/api/routes/shipments.py
apps/backend/src/api/routes/products.py
apps/backend/src/db/inventory_models.py
```

**Goal:** Products flagged dangerous_goods=true cause shipments to require an ADG declaration PDF before dispatch; shipping API rejects without it.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_shipments.py -k dangerous_goods
2. pnpm turbo run type-check
3. UI: /shipments/new with a DG product → 'Attach ADG declaration' is required; without, 'Dispatch' button disabled.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1824 — https://linear.app/unite-group/issue/UNI-1824/shipping-add-dangerous-goods-declaration-for-cleaning-chemicals-adg
Triggered automatically by Pi-CEO autonomous poller.


## Session: a276d3d7699e
