# Go-Live Runbook — CCW ERP 2026

**Ref:** UNI-1922 | **Stack:** Next.js 15 (Vercel) · FastAPI (Render — migration to Vercel tracked in UNI-1948) · Supabase Cloud AU · Cin7

---

## 1. Pre-flight Checklist (T-7 days to T-1 day)

Complete every item before go/no-go gate. Owner signs off in the Dry-Run Log (§8).

### Infrastructure

- [ ] Supabase AU region confirmed; PITR enabled; manual backup triggered and verified restores
- [ ] Vercel production domain DNS propagated (`ccw.com.au` or equivalent); HTTPS cert active
- [ ] Render service (backend) health endpoint `/health` returns 200 in prod env
- [ ] SSL cert expiry >90 days post launch; auto-renew confirmed
- [ ] Vercel env vars match staging exactly (diff checked); no `NEXT_PUBLIC_*` secrets

### Application

- [ ] Feature flags: all in-progress flags set to `off` in prod; only launch-day flags `on`
- [ ] Cin7 API credentials rotated for prod; webhook endpoints pointed at prod URL
- [ ] Supabase RLS policies reviewed; no `anon` read access to sensitive tables
- [ ] All pending Supabase migrations applied to prod branch; schema matches staging
- [ ] AI Search (UNI-1772) feature flag set to `off` for initial launch (activate post-stability)

### Monitoring & On-call

- [ ] BetterStack monitors active: API latency, error rate, Supabase connection pool
- [ ] Sentry project pointing at prod DSN; sample rate 1.0 for first 48h, then reduce
- [ ] On-call engineer confirmed and paged-in for 48h window; backup engineer nominated
- [ ] Escalation path documented: on-call → deploy engineer → comms lead

### Staging Parity

- [ ] Staging smoke test passed within 48h of planned cutover (see `docs/production-smoke-test.md`)
- [ ] Staging data sanitised (no real customer PII in staging DB)
- [ ] Dry-run rehearsal completed on staging; log filed in §8

### Access

- [ ] Vercel deploy token scoped to prod project; rotate after go-live
- [ ] Supabase service-role key confirmed in Render env; not in git history
- [ ] On-call engineer has Supabase dashboard access (AU region project)

---

## 2. Cutover Order (Launch Day)

Run steps sequentially. Record actual timestamps in Dry-Run Log (§8).

| #   | Step                                                                                     | Owner            | Expected Duration |
| --- | ---------------------------------------------------------------------------------------- | ---------------- | ----------------- |
| 1   | **Freeze** — merge cut; no PRs to `main` until all-clear                                 | Deploy engineer  | T+0               |
| 2   | **Tag release** — `git tag v1.0.0 && git push origin v1.0.0`                             | Deploy engineer  | T+2 min           |
| 3   | **Backend deploy** — trigger Render deploy from tag; wait for health check green         | Deploy engineer  | T+10 min          |
| 4   | **Run migrations** — `supabase db push` against prod; verify row counts unchanged        | On-call engineer | T+15 min          |
| 5   | **Frontend deploy** — promote Vercel preview build to production; verify domain resolves | Deploy engineer  | T+20 min          |
| 6   | **Smoke test** — run `docs/production-smoke-test.md` checklist; all checks must pass     | On-call engineer | T+35 min          |
| 7   | **Cin7 integration check** — trigger a test sync; confirm webhook receipt logged         | On-call engineer | T+40 min          |
| 8   | **Announce** — comms lead sends all-clear (use template in §4)                           | Comms lead       | T+45 min          |
| 9   | **Monitor** — BetterStack dashboard open; on-call watches for 60 min post-announce       | On-call engineer | T+105 min         |

> If any step fails, stop and assess against rollback triggers (§3) before proceeding.

---

## 3. Rollback Triggers

Roll back **immediately** if any threshold is breached. Do not wait for a second opinion.

| #   | Trigger                                        | Threshold                                                                                | Action                           |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **Error rate** — 5xx responses on any endpoint | >1% of requests over any 5-min window                                                    | Rollback                         |
| 2   | **API p95 latency**                            | >2 s sustained for >5 min                                                                | Rollback                         |
| 3   | **Data loss or corruption detected**           | Any row count decrease not explained by deliberate delete; any FK violation in prod logs | Rollback + page Supabase support |
| 4   | **Cin7 sync failure**                          | Consecutive failures >3; no successful sync in 15 min post-launch                        | Rollback                         |
| 5   | **Auth broken**                                | >2% of login attempts returning 401/403 unexpectedly                                     | Rollback                         |
| 6   | **Frontend 404 storm**                         | >10 pages returning 404 that were 200 on staging                                         | Rollback                         |

**Rollback procedure:** See `docs/runbooks/rollback-procedure.md`. Short form: revert Vercel to previous deployment; re-point backend to previous Render deploy; restore Supabase from pre-cutover snapshot if data affected.

---

## 4. Stakeholder Comms Templates

Copy-paste. Fill `[BRACKETS]`. Send from comms lead's account.

### T-1 week

> **Subject: CCW ERP go-live — [DATE], your action required**
>
> Hi team,
>
> CCW ERP goes live on [DATE] at approximately [TIME] AEST. From that point, all orders, quotes, and customer records are managed through the new system.
>
> Action required before [DATE-3]:
>
> - Confirm your login credentials work in staging: [STAGING_URL]
> - Complete any open data entry in the legacy system
>
> Contact [COMMS_LEAD] with questions.

### T-24 hours

> **Subject: CCW ERP go-live TOMORROW — [TIME] AEST**
>
> Reminder: go-live is tomorrow at [TIME] AEST. The system will be in read-only mode from [READ_ONLY_START] to [CUTOVER_END] (approx. [DURATION]).
>
> You will receive an all-clear message when the new system is live. Do not attempt to log in until then.

### Cutover start

> **Subject: CCW ERP — cutover in progress (system unavailable)**
>
> Cutover has begun. The ERP is unavailable until further notice. Estimated completion: [ETA] AEST.
>
> For urgent enquiries contact [EMERGENCY_CONTACT].

### All-clear

> **Subject: CCW ERP — LIVE**
>
> CCW ERP is live as of [TIME] AEST. You can now log in at [PROD_URL].
>
> If you encounter any issues, contact [SUPPORT_CONTACT] immediately.

### Rollback

> **Subject: CCW ERP — go-live postponed**
>
> We have rolled back the go-live due to [BRIEF_REASON]. The system has reverted to its previous state; no data has been lost.
>
> We will communicate a revised launch date within [TIMEFRAME]. Apologies for the disruption.

### Post-mortem invite (rollback scenario only)

> **Subject: CCW ERP go-live post-mortem — [DATE] [TIME] AEST**
>
> We are holding a 30-minute post-mortem to review what happened and agree on a revised launch plan.
>
> Attendees: [NAMES]
> When: [DATE] [TIME] AEST
> Where: [LINK]
>
> Please come with a brief timeline of what you observed.

---

## 5. Go/No-Go Decision Matrix

Assessed by on-call engineer and deploy engineer jointly, no less than 1 hour before cutover.

| Criterion                    | Green (proceed)                 | Amber (proceed with caution)             | Red (abort)                      |
| ---------------------------- | ------------------------------- | ---------------------------------------- | -------------------------------- |
| Staging smoke test           | All checks pass within 48h      | 1–2 minor UI issues, no data/auth issues | Any auth, data, or Cin7 failure  |
| Backend error rate (staging) | <0.1% over last 24h             | 0.1–0.5%; root cause known               | >0.5% or unknown cause           |
| API p95 latency (staging)    | <800 ms                         | 800 ms–1.5 s                             | >1.5 s                           |
| Supabase backup verified     | Restore tested successfully     | Backup exists but restore untested       | No backup or failed restore      |
| Cin7 integration             | Test sync completes <30 s       | Test sync completes 30–90 s              | Test sync fails or times out     |
| On-call roster               | Both on-call + backup available | On-call available; backup unreachable    | On-call unavailable              |
| Outstanding P0 bugs          | Zero                            | TBD by on-call engineer                  | Any open P0                      |
| Feature flags                | All in-progress flags `off`     | TBD by deploy engineer                   | Any uncertain flag state in prod |

**Decision rule:** All green → proceed. Any amber → team agrees explicitly to proceed. Any single red → abort.

---

## 6. Post-Cutover Verification

### First 60 minutes

- [ ] BetterStack: error rate <0.1%, p95 <800 ms
- [ ] Sentry: zero new `fatal` events
- [ ] Cin7: at least one successful sync cycle logged
- [ ] Auth: sample of 5 users log in successfully
- [ ] Orders/Quotes: create and save one test record; verify in DB
- [ ] Supabase dashboard: connection pool <70% utilised

### First 24 hours

- [ ] Review Sentry daily digest; triage any new errors
- [ ] Confirm overnight Cin7 sync completed without error
- [ ] Check Supabase PITR is recording (backup log shows entries)
- [ ] Verify no unexpected cost spike in Vercel/Render/Supabase dashboards
- [ ] Collect first-day user feedback; log in Linear as bugs or improvements

### First week

- [ ] Error rate trend stable or improving
- [ ] p95 latency trend stable or improving
- [ ] Cin7 sync success rate >99%
- [ ] User-reported issues triaged and assigned in Linear
- [ ] Hold 30-min team retrospective; document lessons in `decisions-log.md`
- [ ] Re-evaluate AI Search (UNI-1772) activation readiness

---

## 7. Owners

| Role                 | Responsibilities                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **On-call engineer** | Monitors BetterStack/Sentry during cutover and 48h post-launch; executes rollback if triggered; first escalation point for prod issues |
| **Deploy engineer**  | Executes cutover steps §2; manages Vercel and Render deploys; tags release; enforces merge freeze                                      |
| **Comms lead**       | Sends all stakeholder communications (§4); manages external expectations; coordinates post-mortem if needed                            |

> Named assignments: TBD by on-call engineer (confirm in Dry-Run Log before launch).

---

## 8. Dry-Run Log

Fill in during the staging rehearsal. Copy this section into a dated file (`dry-run-YYYY-MM-DD.md`) after completion.

| Step                 | Planned time | Actual time | Duration | Issues | Decision |
| -------------------- | ------------ | ----------- | -------- | ------ | -------- |
| 1 — Freeze           |              |             |          |        |          |
| 2 — Tag release      |              |             |          |        |          |
| 3 — Backend deploy   |              |             |          |        |          |
| 4 — Run migrations   |              |             |          |        |          |
| 5 — Frontend deploy  |              |             |          |        |          |
| 6 — Smoke test       |              |             |          |        |          |
| 7 — Cin7 check       |              |             |          |        |          |
| 8 — Announce         |              |             |          |        |          |
| 9 — Monitor (60 min) |              |             |          |        |          |

**Rehearsal date:** ****\_\_\_****
**Go/no-go decision:** ****\_\_\_****
**Issues encountered:**

1.
2.
3.

**Pre-flight items not yet complete at time of rehearsal:**

- TBD by on-call engineer

**Signed off by:**

| Role             | Name | Time |
| ---------------- | ---- | ---- |
| On-call engineer |      |      |
| Deploy engineer  |      |      |
| Comms lead       |      |      |
