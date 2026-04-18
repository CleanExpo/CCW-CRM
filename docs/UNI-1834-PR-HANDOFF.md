# UNI-1834 — AP Ageing Report: PR Handoff

**Ticket:** [UNI-1834](https://linear.app/unite-group/issue/UNI-1834)  
**Branch:** `feat/uni-1834-ap-ageing-report`  
**Base:** `main` (`9e32fbe`)  
**Head SHA:** `d53fedb`  
**Status:** READY-PR — commit authored in sandbox, Phill must push + open PR

---

## What was built

| Layer | Change |
|-------|--------|
| **Backend** | `GET /api/analytics/ap-ageing` — PurchaseOrder join Supplier, buckets 0–30/31–60/61–90/90+, excludes draft/cancelled, auth-gated |
| **Backend models** | `APAgeingReport`, `APAgeingSupplierRow`, `APAgeingBuckets` (Pydantic, Decimal fields) |
| **Frontend** | `ApAgeingDashboard.tsx` — bucket cards, stacked-bar, supplier table |
| **Frontend** | `reports/page.tsx` — AP Ageing tab added alongside Sales/Inventory |
| **Tests** | `tests/api/test_analytics.py` — 10 tests: 200 OK, field shapes, bucket-sum invariant, non-negative, as_of_date param, 422 on bad date |

---

## Files changed

```
M  apps/backend/src/api/routes/analytics.py
A  apps/backend/tests/api/test_analytics.py
A  apps/web/app/(dashboard)/reports/components/ApAgeingDashboard.tsx
M  apps/web/app/(dashboard)/reports/page.tsx
```

---

## PowerShell — push + open PR

Run from `C:\CCW-Online ERP` (your local checkout on main):

```powershell
# 1. Fetch what Claude staged in the sandbox
git fetch origin feat/uni-1834-ap-ageing-report

# 2. Push to GitHub
git push origin feat/uni-1834-ap-ageing-report

# 3. Open PR via gh CLI  (or open the URL that 'git push' prints)
gh pr create `
  --base main `
  --head feat/uni-1834-ap-ageing-report `
  --title "feat(backend,web): AP ageing report — supplier liability visibility (UNI-1834)" `
  --body "## Summary

- **GET /api/analytics/ap-ageing** — bucketed AP liability (0-30/31-60/61-90/90+ days) from PurchaseOrders joined to Suppliers. Excludes draft/cancelled POs. Auth-gated. Falls back to \`created_at\` when \`order_date\` is NULL.
- **ApAgeingDashboard.tsx** — bucket summary cards, stacked-bar chart, supplier breakdown table. All Decimal values handled as \`string | number\` (FastAPI sends float).
- **reports/page.tsx** — adds AP Ageing tab (FileText icon) alongside Sales KPIs and Inventory Health.
- **tests/api/test_analytics.py** — 10 tests: 200 OK, required field shapes, bucket-sum invariant, non-negative buckets, as_of_date query param, 422 on invalid date.

## Smoke tests (sandbox)

- \`python3 -m py_compile apps/backend/src/api/routes/analytics.py\` → OK
- AST parse analytics.py + test_analytics.py → OK
- TypeScript: \`npx tsc --noEmit\` returned 0 errors on touched files

## Verification Checklist

| # | Where | How | See | NOT see |
|---|-------|-----|-----|---------|
| 1 | Backend | \`uv run pytest tests/api/test_analytics.py -k ap_ageing -v\` | 10 passed | FAILED |
| 2 | Backend | \`curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/analytics/ap-ageing\` | JSON with \`as_of_date\`, \`buckets\`, \`suppliers\` | 500 / 404 |
| 3 | UI | Navigate to /reports → AP Ageing tab | Bucket cards, stacked bar, supplier table | Blank page / error toast |
| 4 | UI | Refresh button | Data reloads without full-page refresh | Loading spinner hangs |
| 5 | Backend | \`pnpm turbo run type-check\` | Zero errors | TypeScript errors on ApAgeingDashboard |

## Linear ticket

[UNI-1834](https://linear.app/unite-group/issue/UNI-1834)"
```

---

## If the fetch fails (branch not on origin yet)

Claude's commit exists only in the sandbox checkout. As an alternative, copy the 4 files manually from the Pi-CEO session and commit locally:

```powershell
# After copying files to your local checkout:
git checkout -b feat/uni-1834-ap-ageing-report
git add apps/backend/src/api/routes/analytics.py `
        apps/backend/tests/api/test_analytics.py `
        "apps/web/app/(dashboard)/reports/components/ApAgeingDashboard.tsx" `
        "apps/web/app/(dashboard)/reports/page.tsx"
git commit -m "feat(backend,web): AP ageing report — supplier liability visibility (UNI-1834)"
git push origin feat/uni-1834-ap-ageing-report
```
