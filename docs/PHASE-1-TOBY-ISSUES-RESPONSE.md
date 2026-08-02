# Phase 1 — Client issues response (Toby)

Date: 2026-07-31  
Scope: Cin7 sync, fail-closed reconciliation, nightly unattended sync

---

## Executive answer to the 30,332 / 3,641 question

**Did Optix ever store 30,332 customers?**  
Possibly temporarily if a prior run upserted that many rows — Optix sync **does not delete** customers on later syncs. A drop from 30k → 3.6k linked rows usually means either (a) the recon report was comparing an incomplete/truncated Cin7 fetch to itself or to a cached figure (false clean), or (b) “Optix” in the old UI was showing Cin7-linked count while most rows were never durably linked. The dashboard **must not** copy Cin7 counts into the Optix column.

**Was the dashboard displaying Cin7 on both sides?**  
That was a credible failure mode of the old **live, fail-open** reconciliation (incomplete Cin7 page pull + empty treated as EOF → both sides looked “aligned” at a truncated number). That path is replaced by **fail-closed, DB-backed** reconciliation: Optix = Postgres SQL only; Cin7 = durable catalog snapshot only after a complete pull. If sync is incomplete, status is **blocked** and Cin7 shows **n/a** — never a matching clean zero report.

---

## Issue-by-issue status

| #   | Toby issue                                               | Root cause found                                                                                              | Fix applied                                                                                                                 | Status                                          |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | False “0 missing / 0 extra” while ~27k customers missing | Live recon fail-open; empty-after-error treated as EOF; incomplete Cin7 catalog                               | Fail-closed gate on all Phase 1 `Cin7SyncRun.status===complete` + complete Cin7 snapshot; blocked shows sentinel + Cin7 n/a | Fixed in code — verify after full customer sync |
| 2   | Acceptance gate broken                                   | Same as #1                                                                                                    | Same; acceptance HTTP 409/422 with `?acceptance=true`                                                                       | Fixed in code                                   |
| 3   | Nightly sync stopped (last ~30 Jul)                      | Likely cron not completing / restart-from-page-1 each night / missing `CRON_INTEGRATION_USER_ID`              | Nightly **resumes incomplete** entities; restarts only complete/failed/idle; ledger + `/api/integrations/cin7/sync-proof`   | Fixed in code — needs Vercel cron + env         |
| 4   | Customer sync stops at exactly 2,000                     | Historical pageSize 100 × ~20 pages **and/or** short-page treated as EOF when API returns &lt; requested rows | Removed partial-page EOF; only empty+no-error = EOF; contacts `where` not over-encoded; resume across chunks                | Fixed in code — re-run Sync Customers           |
| 5   | Resume restarts at page 1                                | Client defaulted `restart: true`; Sync Controls always restarted; nightly always `?restart=true`              | Default **resume**; UI restarts only never/complete/failed; nightly resumes incomplete                                      | Fixed in code                                   |
| 6   | HTTP 429 handled as empty success                        | Empty page after 429 treated as EOF on old path; weak Retry-After                                             | Retry-After up to 5 min; exponential backoff; empty+error → incomplete (never complete); more retries                       | Fixed in code                                   |
| 7   | Cin7 counts jumped ~8k in days                           | Incomplete Cin7 fetches reported as “catalog size”                                                            | Snapshot only after complete pull; incomplete → blocked                                                                     | Fixed in code                                   |
| 8   | Stock / master data improved                             | Acknowledged                                                                                                  | Keep                                                                                                                        | Positive                                        |
| 9   | Suppliers 2 extras                                       | Optix has 2 `cin7:*` suppliers not in current Cin7 snapshot (or type filter)                                  | Compare uses `supplierCode` prefix; extras remain as real data until reviewed                                               | Needs data review after full supplier sync      |
| 10  | Legacy 3,580 customers — merge vs not                    | Docs conflicted; **code never merges by email**                                                               | Upsert by `cin7ContactId` only; UI notes clarify extras = unlinked legacy                                                   | Clarified                                       |
| 11  | Field differences 1 vs 3 fields                          | Unclear in UI                                                                                                 | Counted **per field occurrence** (3 bad fields = 3); documented in recon notes                                              | Clarified                                       |
| 12  | Phase 1 acceptance list                                  | Criteria agreed                                                                                               | Engine + gate + nightly ledger designed for those criteria                                                                  | Pending operational proof (3 nights)            |
| 13  | Phase 2 not approved                                     | Correct until Phase 1 closes                                                                                  | No Phase 2 work claimed                                                                                                     | Acknowledged                                    |
| 14  | Xero disconnected / SendGrid failing                     | Outside Cin7 sync                                                                                             | Not changed in this pass — must fix before Area 8                                                                           | Open                                            |

---

## Nightly schedule (9pm Australian / Brisbane)

| Item         | Value                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- |
| Vercel cron  | `0 11 * * *` → **21:00 AEST** (Brisbane, UTC+10)                                            |
| Path         | `/api/cron/nightly-full-sync`                                                               |
| Required env | `CRON_SECRET`, `CRON_INTEGRATION_USER_ID`                                                   |
| Proof API    | `GET /api/integrations/cin7/sync-proof` → `consecutive_complete_count`, `proof_ready` (≥ 3) |

**How to check last successful run**

1. Call `/api/integrations/cin7/sync-proof` (authenticated).
2. Or query table `cin7_nightly_sync_ledger` ordered by `started_at` desc.
3. Per-entity checkpoints: `cin7_sync_runs` (`status`, `last_committed_page`, `next_page`, `records_processed`, `completed_at`).

If ledger is empty since 30 Jul, the cron did not complete successfully (auth/env/deployment) — not a “silent success.”

---

## What to do now (ops checklist)

1. Deploy this branch; confirm `prisma migrate deploy` applied sync/recon engine migration.
2. On Integrations: **Sync Customers** once — if incomplete, click Sync again (resume, not page 1). Repeat until status `complete` and records ≈ Cin7 total.
3. Sync remaining Phase 1 entities until all `complete`.
4. Rebuild reconciliation — must not show clean zeros while any entity incomplete.
5. Confirm Vercel cron for `nightly-full-sync` is enabled and `CRON_INTEGRATION_USER_ID` is set.
6. After 3 consecutive green nights, `proof_ready: true` on sync-proof.
7. Reconnect Xero; fix SendGrid API key before Area 8.
8. Investigate the 2 supplier extras after a complete supplier sync (export exception CSV).

---

## Tests run (this pass)

- `cin7-sync-recon-engine.test.ts` — Retry-After, empty-after-error ≠ EOF, checkpoint after persist, short-page ≠ complete, fail-closed gate list
- `cin7-client-requirements.test.ts` — static route/UI checks

---

## Phase 1 close-out (still required for Toby sign-off)

- [ ] Customer sync reaches full Cin7 count automatically (resume + nightly)
- [ ] Resume verified across pages (checkpoint advances only after DB upsert)
- [ ] 429 respected (Retry-After / backoff; never complete on rate-limit empty)
- [ ] Fail-closed recon never false clean
- [ ] Nightly ledger: 3 consecutive complete nights
- [ ] Supplier extras explained/resolved
- [ ] Legacy customer + field-diff clarifications accepted
- [ ] Exception report genuine zero
- [ ] Signed close-out document

Phase 2 remains **not approved** until the above are met.
