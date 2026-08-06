# Nightly Sync Verification Guide

**Updated**: 2026-08-07

> **What changed.** Until 2026-08-07 this guide told you to verify the nightly sync by calling
> `/api/cron/shadow-sync-cin7` and `/api/cron/auto-reorder-inventory`. Those endpoints forwarded to
> a separate backend service that no longer exists, so they returned HTTP 501 and did nothing —
> including when Vercel called them on schedule. They have been removed. The sync that actually
> runs is `/api/cron/nightly-full-sync`, and it is the only one this guide now covers.
> `scripts/ci/validate-vercel-crons.js` now fails CI if a scheduled cron ever goes hollow again.

---

## Sync Schedule

All Vercel crons are configured in UTC. CCW operates on AEST (Brisbane, UTC+10, no daylight
saving), so both are given below. This table is enforced against `vercel.json` by
`node scripts/ci/validate-vercel-crons.js`.

| AEST     | UTC cron       | Path                                       | What it does                                       |
| -------- | -------------- | ------------------------------------------ | -------------------------------------------------- |
| every 5m | `*/5 * * * *`  | `/api/cron/health-check`                   | Liveness probe                                      |
| every 15m| `*/15 * * * *` | `/api/cron/refresh-xero-tokens`            | Keeps the Xero OAuth token fresh                    |
| every 15m| `*/15 * * * *` | `/api/cron/check-sla-breaches`             | Flags support SLAs about to breach                  |
| 12:00 PM | `0 2 * * *`    | `/api/cron/cleanup-old-runs`               | Prunes historical run records                       |
| 4:00 PM  | `0 6 * * *`    | `/api/cron/sync-bank-feeds`                | Pulls bank feed transactions                        |
| 7:00 PM  | `0 9 * * *`    | `/api/cron/daily-report`                   | Refreshes KPI metrics on the Dashboard              |
| 8:00 PM  | `0 10 * * *`   | `/api/cron/check-invoice-overdue`          | Overdue-invoice notifications                       |
| 9:00 PM  | `0 11 * * *`   | `/api/cron/check-trade-finance-maturities` | Trade-finance maturity alerts                       |
| **9:00 PM** | **`0 11 * * *`** | **`/api/cron/nightly-full-sync`**    | **The nightly Cin7 sync — products through stock**  |

---

## What the nightly sync actually does

`/api/cron/nightly-full-sync` walks the Cin7 Omni entities in order, one at a time, so a slow
catalog cannot starve the rest:

`products` · `customers` · `internal-customers` · `suppliers` · `branches` ·
`product-categories` · `brands` · `price-lists` · `tax-codes` · `units-of-measure` ·
`stock-levels`

Two behaviours matter when you are verifying it:

- **It resumes, it does not restart.** Each entity's progress is checkpointed in the
  `Cin7SyncRun` table (`status`, `nextPage`, `lastCommittedPage`). If a run hits the serverless
  time budget it stops on a committed page and the next night continues from there rather than
  re-pulling the catalog from page one. A run showing `complete: false` with a `next_page` is
  **progressing normally**, not failing.
- **Partial is reported as partial.** An incomplete run does not report success. The
  reconciliation card surfaces sync-completeness and unreachable-Cin7 warnings rather than
  celebrating a partial pull.

---

## How to Manually Trigger a Sync

### Option A — via Dashboard (recommended)

1. Log in to CCW Online
2. Go to **Settings → Integrations → Cin7**
3. Use **Sync from Cin7** — it auto-resumes and reports an incomplete run rather than a false success

### Option B — via API (for developers)

The handler authenticates with a bearer token, not an `x-cron-secret` header:

```bash
curl -X GET https://ccwonline.com.au/api/cron/nightly-full-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Verification Checklist

- [ ] Products count matches Cin7 (check `/products`)
- [ ] Stock levels updated (check `/inventory` and compare with Cin7)
- [ ] Customers synced (check `/customers` for recent Cin7 records)
- [ ] Settings → Integrations → Cin7 shows no sync-completeness or unreachable warnings
- [ ] Vercel Dashboard → the project's **Cron Jobs** tab → `nightly-full-sync` last execution is
      within 24h and succeeded
- [ ] Logs: **Vercel** → Logs, filtered to `/api/cron/nightly-full-sync`

---

## Troubleshooting

Logs live in **Vercel**, not Railway. Environment variables are set on the Vercel project, not on
a Railway service — earlier revisions of this guide said otherwise and were wrong.

| Issue                        | Check                                                    | Fix                                                       |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Sync not running at all      | Vercel → Cron Jobs tab: last execution time               | Confirm `CRON_SECRET` is set on the Vercel project         |
| Cin7 returns 401             | Vercel logs: `CIN7_API_KEY`                               | Set `CIN7_API_KEY` in Vercel project env vars              |
| Run never reaches `complete` | `Cin7SyncRun` rows: `status`, `nextPage`                  | Expected across a large catalog — check it advances nightly |
| Products not updating        | Vercel logs filtered to the products entity               | Confirm the Cin7 key is a live-mode key                    |
| Xero token expired           | Vercel logs: `xero_token_expired`                         | Re-connect Xero in Settings → Integrations                 |

### Removed endpoints

These were scheduled but returned 501. If you find a runbook, script or bookmark still calling
one, it is stale — nothing replaces them except `nightly-full-sync` for the Cin7 half:

`shadow-sync-cin7` · `shadow-sync-xero` · `auto-reorder-inventory` · `run-autonomous-ops` ·
`refresh-health-scores` · `check-expiring-quotes` · `process-onboarding-emails` ·
`retry-failed-webhooks`

Auto-reorder (draft POs for low-stock items) is **not currently running**. It was never running
from this codebase; the endpoint that claimed to do it returned 501. Treat it as unbuilt.
