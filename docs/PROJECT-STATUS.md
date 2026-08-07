# CCW-CRM — Project Status (Ground Truth)

**Document owner:** Engineering
**Last updated:** 2026-08-07
**Measured against:** `main` at `8b61de85` (PR #266)
**Supersedes:** the 2026-06-11 revision of this file, and with it
`GO_LIVE_SIGNOFF.md`, `COMPLETION-REPORT.md`, `DEPLOYMENT_ROADMAP_SUMMARY.md`

---

## How to read this document

Every claim carries the command that produced it and the date it was run. Nothing is carried
forward from a previous revision without re-running it — the 2026-06-11 revision was accurate when
written, and four of its headline claims had gone stale by the time anyone next checked. That is
the failure this format exists to prevent.

If a claim here is older than your change, re-run its command rather than quoting it.

---

## 0. The blocker — production has no database

**Severity: the application does not work. Nobody can log in.**

```
$ curl -X POST https://ccw-crm-web.vercel.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"...","password":"..."}'
{"detail":"Authentication service unavailable"}   HTTP 503   (3 of 3 attempts)
```

`src/lib/db/prisma.ts:53` throws `DATABASE_URL is not configured` because
`getDatabaseConnectionString()` resolves empty on the deployment. Neither `DATABASE_URL` nor the
`DB_HOST`/`DB_USER`/`DB_PASSWORD` triple is set on the Vercel project.

Vercel runtime errors for `prj_oTCifkMVqP1NFoTJFBv6u82JmBYd`, live deployment
`dpl_Ae5tEme3CkdmEJdWf2mRqfkmaa6w`, show the same root cause across the app:

| Route                           | Occurrences | First seen |
| ------------------------------- | ----------- | ---------- |
| `/api/cron/refresh-xero-tokens` | 96          | 2026-07-05 |
| `/api/auth/login`               | 5           | 2026-08-06 |
| `/api/cron/daily-report`        | 1           | 2026-07-07 |
| `/api/cron/cleanup-old-runs`    | 1           | 2026-07-07 |
| `/api/cron/health-check` (failing probe) | 288 | 2026-06-16 |

The marketing pages render because they need no database. Everything behind the login does not.

### Which database is production is an OPEN QUESTION

Do not assume. An earlier draft of this section asserted the database was the Supabase project
"NodeJS Starter V1" (`pwwwhoaxxtkmowifpuwf`). That was carried from a stale note rather than
measured, and measurement contradicts it:

```
-- run against pwwwhoaxxtkmowifpuwf, 2026-08-07
app_users                 exists: false     <- the table /api/auth/login reads
cin7_sync_runs            exists: false
cin7_branches             exists: false
workspace_settings        exists: false
invoices                  exists: false
ccw_addon_feature_configs exists: false
customers                 exists: true
products                  exists: true
```

77 of the 105 `@@map` targets in `prisma/schema.prisma` are absent from that project, including
`app_users`. Login could not work there even with a correct connection string. Its populated tables
belong to unrelated applications.

The code points at DigitalOcean instead: `src/lib/db/database-env.ts` resolves
`DB_HOST`/`DB_USER`/`DB_PASSWORD` with libpq SSL compatibility and P1011 self-signed-certificate
handling for DigitalOcean managed Postgres, and `src/lib/db/prisma.ts:148` states those variables
are "only available at runtime on DigitalOcean".

**Before setting anything**, confirm where CCW's live data actually is — `doctl auth init` then
`doctl databases list` will settle the DigitalOcean side; it was not authenticated when this was
written, so that check has not been run.

If the answer turns out to be a Supabase project, the correct action is `prisma migrate deploy`
against a dedicated project, never hand-written SQL against a shared one. Use the **transaction
pooler** string (port 6543), not a direct `db.<ref>` host — serverless functions exhaust direct
connections.

**This requires a production credential and must not be changed without the owner.**

---

## 1. Live gate results — run 2026-08-07

Run from a clean checkout with `DATABASE_URL` **unset**, to prove none of these need a database.

```
$ npm ci                exit 0   (postinstall runs prisma generate successfully)
$ npm run lint          exit 0   0 errors, 0 warnings
$ npm run type-check    exit 0   0 errors
$ npm run test          exit 0   385 passed, 2 skipped, 49 files
$ npm run test:coverage exit 0   thresholds met
$ npm run build         exit 0
```

Validators, all passing including their self-tests:

```
$ node scripts/ci/validate-hooks.js
$ node scripts/ci/validate-agents.js
$ node scripts/ci/validate-cron-jobs.js
$ node scripts/ci/validate-vercel-crons.js     [--self-test]
$ node scripts/ci/validate-css-sources.js      [--self-test]
$ node scripts/ci/validate-deepsec-workflow.js [--self-test]
$ node scripts/ci/scan-secrets.js
```

Browser and performance gates, run against production:

```
$ npm run test:e2e         public specs pass; 20 authenticated specs fail
$ npm run test:lighthouse  FAIL — 5 assertions
```

The 20 authenticated failures are all the section-0 blocker — no database, so login 503s. They are
correct tests reporting a real outage, not flaky tests to quarantine.

The public specs pass. They previously reported 23 nodes on `/` failing WCAG AA colour contrast;
that was fixed and deployed on 2026-08-07 and re-measured on production at zero. CI now runs the
public accessibility specs against the candidate on every push (`e2e-public`, blocking).

Lighthouse against production, measured 2026-08-07 after that deploy: **LCP 3293ms against a
2500ms budget**, plus `speed-index`, `bf-cache`, `legacy-javascript-insight` and
`network-dependency-tree-insight`. **`color-contrast` now passes** — it scored 0 before the fix,
independently corroborating the axe result in both directions. `forced-reflow` no longer appears.
Evidence and what has been ruled out: `docs/PERFORMANCE-FINDINGS.md`.

Re-measured later the same day after `f4fc4779` (PR #269) deployed: **three blocking failures, down
from five.** `bf-cache` now passes on all nine runs, the one improvement causally attributable to
that PR. **LCP did not move** — 3105ms best / 3393ms median on `/`, still failing. `speed-index` is
no longer reported as failing, but the gate is judging it on its best of three runs; its median on
`/` is 4451ms against a 3000ms budget. Both are recorded in `docs/PERFORMANCE-FINDINGS.md`.

Three further PRs merged later the same day, after those runs: **#271** (`41ab85ae`) made the gate
median-aggregated and put `/api/health` on the public allowlist, **#272** (`c367cb0c`) cut the
dual-font CSS chain the trace had localised, and **#273** (`62fb5248`) added an applied-throttling
trace showing LCP is credited to a 2,226px² logo tagline rather than the hero. **Lighthouse has not
been re-run against any of them**, so the figures in this section describe the pre-#272 build and
are a baseline, not current state.

---

## 2. Corrections to the 2026-06-11 revision

Four claims were re-measured and are no longer true. Recorded rather than silently overwritten,
because two of them were used to justify work.

| Previous claim | Measured 2026-08-07 | Why it was wrong |
| --- | --- | --- |
| "type-check FAIL — 219 errors" | **0 errors** | The measurement used `npm install --ignore-scripts`, which skips `prisma generate`. ~180 of the 219 were the generated client simply being absent. The ~39 real implicit-any errors have since been fixed. |
| "type-check requires `DATABASE_URL` at install time" | **It does not** | `prisma generate` succeeds with the variable unset, and the full gate above ran green without it. The previous revision blamed a missing secret for a flag it had set itself. |
| "139 unit tests" | **385 passing, 2 skipped** | Growth since June. Neither figure matched the 823 claimed in `CCW-Product-Report.md`, which is corrected on this branch — though its PDF is not. |
| "Cin7 shadow sync — demo-grade, shadow store in-memory, real Cin7 API not integrated" | **Production-grade** | `src/lib/integrations/cin7-omni.ts` is a real HTTP client with retries and a time budget, backed by 17 Prisma models, with pagination and cross-night resume. It is the strongest thing in the repo. |

Two of its open tasks are also done: `WorkspaceSettings` exists in the schema (TASK-1), and portal
orders are Prisma-backed (TASK-2).

Its claim that **staging deploy is RED on missing `STAGING_SSH_*` secrets** is CONFIRMED as of
2026-08-07: the workflow runs `ssh-keyscan -H  >> ~/.ssh/known_hosts` with an empty host because
`STAGING_SSH_HOST` is unset, and the Smoke Tests job is skipped as a consequence (UNI-2106). It is
a missing secret, not a code fault. Note separately that `deploy-staging.yml` invokes
`./deployment/scripts/smoke-tests.sh`, and `deployment/` does not exist in this repo.
`deploy-production.yml` does NOT — it implements its smoke checks inline. An earlier revision of
this file claimed both did.

---

## 3. What is production-grade, what is not

| Area | Status | Evidence |
| --- | --- | --- |
| **Database connectivity** | **BROKEN in production** | Section 0 |
| Cin7 Omni sync | Production-grade | `cin7-omni.ts`, 17 Cin7 Prisma models, resumable across nights |
| Auth layer and RBAC | Production-grade in code | `src/middleware.ts` deny-by-default with an explicit allowlist; not verifiable live while login is down |
| Unit test suite | Production-grade | 385 passing |
| CI quality gate | Production-grade | lint, type-check, coverage, build — all enforced |
| Scheduled crons | Production-grade **as of 2026-08-07** | 8 of 17 were 501 stubs and were removed; `validate-vercel-crons.js` blocks their return |
| Design tokens | Single source **as of 2026-08-07** | `globals.css`; orphaned `design-system.css` deleted. See `docs/design-system.md` |
| Accessibility | **Passing on the public surface** | The 23 contrast violations are fixed and live: axe found 23 on this URL before the deploy and 0 after, and Lighthouse's `color-contrast` now passes. The authenticated surface stays unmeasured while login is down |
| Core Web Vitals | **Failing as last measured; re-measurement outstanding** | LCP 3105ms best / 3393ms median on `/` vs a 2500ms budget, measured after PR #269. Not origin latency — server response is 22ms with zero savings. The trace localised 73% of LCP to render delay behind three render-blocking stylesheets; PR #272 (`c367cb0c`) then cut that chain, and **nothing has been re-run since**, so whether it still fails is unknown. Separately, PR #273 established the credited LCP element is a 2,226px² logo tagline, not the hero, because an `opacity: 0` reveal makes the hero ineligible — so the budget is not currently measuring hero render time. See `docs/PERFORMANCE-FINDINGS.md` |
| Performance gate itself | **Partly fixed — preset audits still optimistic** | PR #271 (`41ab85ae`) set `aggregationMethod: 'median'` on nine enumerated assertions, which closes `speed-index`. It did **not** set it at the `assert:` level, so every assertion inherited from `preset: 'lighthouse:recommended'` still runs on lhci's `optimistic` default. `document-latency-insight` on `/` scores 0.00 on one run in three while the gate reports 1.00. Still a one-line fix |
| `/api/health` | **Fixed 2026-08-07** | PR #271 (`41ab85ae`) added it to the middleware public allowlist as an exact match, so `/api/health/deep` is not exposed by prefix. It previously 307'd to `/login`, and `curl -fL` exited 0 against a 200 HTML page. Expect monitors to begin reporting the ERP unhealthy — the endpoint returns 503 while `hasDatabaseConfig()` is false, which is production's state per Section 0. That is the fix working |
| Webhook retry, autonomous ops, health-score refresh, quote-expiry alerts, onboarding emails, auto-reorder | **Not built** | Their endpoints returned 501 and were removed. They were never running |
| AP2 agent payments (10 routes), HeyGen (5 routes) | **Not built** | Hard 501 via `notImplementedResponse` |
| Marketplace / multi-channel | **Demo-grade** | Ships a "Demo Mode — all channels running with mock data" banner in production |
| Bank Feeds, Workflows, AI Assistant, Billing | **Shipped disabled** | `comingSoon: true` in `src/components/layout/sidebar.tsx` |
| Staging deploy | **Red, cause confirmed 2026-08-07** | `ssh-keyscan -H  >> ~/.ssh/known_hosts` runs with an EMPTY host because `STAGING_SSH_HOST` is unset (UNI-2106); the Smoke Tests job is skipped as a result. Not a code fault |

---

## 4. Metrics that must not be cited

These appear in earlier documents and are either false or unverifiable. Listed so that finding one
in an old file reads as a red flag rather than a source:

- "97% production-ready", "Platform readiness 95/100"
- "823 automated tests, all passing" — the real figure is 385 passing, 2 skipped. Corrected in
  `CCW-Product-Report.md` on this branch; still present in its PDF and in any copy already sent
- "99.92% uptime" — the health probe has failed 288 times since 2026-06-16
- "96.1% load test pass rate (8000+ scenarios)"
- "Zero critical security findings"
- Any statement that the nightly Cin7 sync runs at 7:00pm via `shadow-sync-cin7` — that endpoint
  returned 501 and has been removed. The real sync is `nightly-full-sync` at 9:00pm AEST

### Archived documents

Annotated ARCHIVED and not to be cited as evidence of readiness:

| File | Written | Why stale |
| --- | --- | --- |
| `docs/GO_LIVE_SIGNOFF.md` | 2026-02-02 | Simulated go-live; sign-off fields blank |
| `docs/DEPLOYMENT_ROADMAP_SUMMARY.md` | 2026-02-02 | References a Python/FastAPI project, not this codebase |
| `docs/COMPLETION-REPORT.md` | 2026-02-05 | Metrics not current |
| `.github/SECRETS.md` | template | References "NodeJS-Starter-V1" — starter-template artefact |
| `docs/swarm-review-2026-03-24/`, `docs/health-scan-2026-03-24/` | 2026-03-24 | Audited an `apps/web` + `apps/backend` FastAPI layout that no longer exists. Their P0-01 and P0-02 findings are fixed by the current `src/middleware.ts` |
| `docs/PRD-CCW-GAPS-2026-03-03.md`, `-03-16.md`, `-03-24.md` | Mar 2026 | Three byte-identical files, generated rather than authored |

---

## 5. Open work, in priority order

1. **Restore the production database connection.** Everything else is blocked behind it. Owner
   action — needs a credential.
2. ~~Fix the 23 contrast violations.~~ **DONE 2026-08-07**, deployed and re-measured at zero on
   production. The marketing surface still bypasses the semantic tokens — it renders outside
   `.dark`, so `--muted-foreground` resolves to its light-theme value — and adopting the token
   scope there remains open. Tracked in `docs/design-system.md`; it is a refactor, not a defect.
3. **Trace the LCP gap, then bring LCP under 2500ms.** Re-measured 2026-08-07 after PR #269: LCP
   3105ms best / 3393ms median on `/` against a 2500ms budget, FCP 1228ms. Origin latency is ruled
   out — server response is 22ms with zero savings available — as are font loading and JS execution
   (TBT 0–13ms). Render-blocking is no longer ruled out: that audit scored 1 before #269 and scores
   0.5 after, with `overallSavingsMs: 0`. What remains unexplained is the two seconds between first
   paint and largest paint; `network-dependency-tree-insight` fails, which establishes a critical
   request chain exists — not that it caused the gap. Start with a trace, and let it name the
   resource. **The trace has now been run** — see below; the diagnosis step is done and what remains
   is a measured change. Evidence and what was ruled out: `docs/PERFORMANCE-FINDINGS.md`. Once green,
   `lighthouse-agentic.yml` can drop `continue-on-error` and become a real gate.

   **Traced 2026-08-07.** Lighthouse's LCP phase breakdown for `/` is TTFB 918ms (27%), Load Delay
   0, **Load Time 0**, **Render Delay 2475ms (73%)**. The LCP element fetches nothing, and it is not
   hydration-gated — the string is in the served HTML. Three render-blocking stylesheets sit in
   `<head>`, and their critical chain ends at 2030ms, inside the render-delay window. The longest
   chain ends on a **990-byte** file, so this is request serialization under throttling, not payload
   size. **Not yet established:** that unblocking them clears the 2500ms budget — TTFB alone is
   918ms, so render delay must fall to about 1580ms. Next step is a change measured against this
   baseline, not more diagnosis.

   **The change landed; the measurement did not.** PR #272 (`c367cb0c`) stopped loading Inter from
   the root layout and preloads Plus Jakarta on marketing surfaces, cutting the chain traced above.
   Lighthouse has **not** been re-run against it, so the numbers in this item are the pre-#272
   baseline. **Re-running `npm run test:lighthouse` against `main` is now the outstanding step** —
   and PR #273 established the credited LCP element is a 2,226px² logo tagline rather than the hero
   (an `opacity: 0` reveal makes the hero ineligible), so read whatever it reports with that in
   mind: the budget is not currently measuring hero render time.

3a. ~~**Make the application cacheable.**~~ **DONE 2026-08-07** — PR #269, merged as `f4fc4779` and
   live. Locale resolution moved from the root layout to `src/app/(dashboard)/layout.tsx:23`.
   Production `/` now serves `cache-control: public, max-age=0, must-revalidate` with
   `x-nextjs-prerender: 1` and `x-vercel-cache: HIT` on repeat requests; `/dashboard` still
   307-redirects and did not become static. `bf-cache` passes. As this document predicted, it did
   not move LCP. One acceptance criterion is still unverified: locale switching on the authenticated
   surface, which needs a login and is blocked on the production database.

3b. **Set `aggregationMethod: 'median'` at the `assert:` level in `lighthouserc.js`.** Still one
   line, and still open. PR #271 (`41ab85ae`) set it on nine enumerated assertions, which fixed
   `speed-index`, but not at the `assert:` level — so every assertion inherited from
   `preset: 'lighthouse:recommended'` is still graded on its best of three runs.
   `document-latency-insight` on `/` scores 0.00 on one run in three while the gate reports 1.00.

3c. ~~**Add `/api/health` to the middleware public allowlist.**~~ **DONE 2026-08-07** — PR #271
   (`41ab85ae`), added as an exact match so `/api/health/deep` is not exposed by prefix. Monitors
   should now start correctly reporting the ERP unhealthy, because the endpoint returns 503 while
   the production database is unconfigured. **Still open:** the broader shape — every other API
   route under the middleware matcher answers an unauthenticated caller with a 307 to HTML rather
   than a JSON 401, so API clients receive a login page where they expect JSON.
4. **Set `STAGING_SSH_HOST`, `STAGING_SSH_USER` and `STAGING_SSH_KEY`** — the staging deploy fails
   on an empty `ssh-keyscan` host, confirmed 2026-08-07 (UNI-2106), and skips its smoke tests as a
   result. Separately, either restore `deployment/scripts/smoke-tests.sh` or remove the workflow
   steps that call it, since that path does not exist in this repo.
5. **Decide the fate of the not-built surface** — AP2, HeyGen, marketplace mock mode, and the four
   `comingSoon` nav items. Shipping a large surface the product cannot stand behind is the main
   thing separating this from a product that demos without caveats.
6. **Regenerate the `CCW-Product-Report` PDF and reissue to CCW** — the markdown is corrected on
   this branch, the PDF is not. See section 6.

---

## 6. The client-facing report

`docs/CCW-Product-Report.md` is what CCW holds. **The markdown in this repo has been corrected on
this branch**; the PDF beside it and any copy already in CCW's hands have not.

Corrected in the markdown:

- The "823 automated tests all passing" sentence now reads 385 passing / 2 skipped
- The §12 cron table now lists the nine scheduled endpoints, with the eight removed 501 endpoints
  named underneath
- The Railway configuration sections carry a notice that no Railway backend exists and those
  variables belong on the Vercel project
- A correction notice at the top of the document summarises all of the above

**Still outstanding:**

- The **PDF has not been regenerated** and still contains every original error
- The copy CCW holds is uncorrected
- Reissuing is customer-facing and should not go out without the owner reading it first, and not
  before the deployment in section 0 is restored
