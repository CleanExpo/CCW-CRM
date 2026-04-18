# Task Brief

[HIGH] [Workshop] Enforce 12-month minimum warranty period — ACL statutory requirement

Description:
## What's missing

The warranty period field on products and service jobs has no minimum validation. A warranty shorter than 12 months can be entered and saved. Under the Australian Consumer Law (ACL), consumer goods must carry a minimum statutory guarantee — setting a shorter warranty is misleading and potentially void.

## Business impact

Warranty periods below ACL minimums expose CCW to consumer guarantee disputes. Under ACL s.54, goods must… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/api/routes/certifications.py
apps/backend/src/api/routes/service_requests.py
apps/backend/src/db/certification_models.py
```

**Goal:** Warranty period on any workshop job defaults to max(product_warranty, 12 months); UI cannot save a value below 12.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_service_requests.py -k warranty
2. pnpm turbo run type-check
3. UI: /workshop/[id] → try to set warranty 6 months → validation error 'minimum 12 months'.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1826 — https://linear.app/unite-group/issue/UNI-1826/workshop-enforce-12-month-minimum-warranty-period-acl-statutory
Triggered automatically by Pi-CEO autonomous poller.


## Session: 88f97f1f28d9
