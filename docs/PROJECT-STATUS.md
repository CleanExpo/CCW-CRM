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

**Fix:** set the database connection on the Vercel project. Use the Supabase **transaction pooler**
string (port 6543), not the direct `db.<ref>` host — serverless functions exhaust direct
connections. The database is the Supabase project named "NodeJS Starter V1", ref
`pwwwhoaxxtkmowifpuwf`.

**This requires a production credential and must not be changed without the owner.**

---

## 1. Live gate results — run 2026-08-07

Run from a clean checkout with `DATABASE_URL` **unset**, to prove none of these need a database.

```
$ npm ci                exit 0   (postinstall runs prisma generate successfully)
$ npm run lint          exit 0   0 errors, 0 warnings
$ npm run type-check    exit 0   0 errors
$ npm run test          exit 0   377 passed, 2 skipped, 49 files
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
$ npm run test:e2e         desktop: 8 passed, 1 failed (public) / 20 failed (authenticated)
$ npm run test:lighthouse  FAIL — 6 assertions
```

The single public E2E failure is real: 23 nodes on `/` fail WCAG AA colour contrast. The 20
authenticated failures are all the section-0 blocker — no database, so login 503s. They are correct
tests reporting a real outage, not flaky tests to quarantine.

Lighthouse against production, measured: **LCP 3195ms against a 2500ms budget**, plus
`color-contrast` at 0 (independently corroborating the axe result), `bf-cache`,
`legacy-javascript`, `network-dependency-tree` and `forced-reflow`.

---

## 2. Corrections to the 2026-06-11 revision

Four claims were re-measured and are no longer true. Recorded rather than silently overwritten,
because two of them were used to justify work.

| Previous claim | Measured 2026-08-07 | Why it was wrong |
| --- | --- | --- |
| "type-check FAIL — 219 errors" | **0 errors** | The measurement used `npm install --ignore-scripts`, which skips `prisma generate`. ~180 of the 219 were the generated client simply being absent. The ~39 real implicit-any errors have since been fixed. |
| "type-check requires `DATABASE_URL` at install time" | **It does not** | `prisma generate` succeeds with the variable unset, and the full gate above ran green without it. The previous revision blamed a missing secret for a flag it had set itself. |
| "139 unit tests" | **377 passing, 2 skipped** | Growth since June. Neither figure matches the 823 still claimed in `CCW-Product-Report.md`. |
| "Cin7 shadow sync — demo-grade, shadow store in-memory, real Cin7 API not integrated" | **Production-grade** | `src/lib/integrations/cin7-omni.ts` is a real HTTP client with retries and a time budget, backed by 12 Prisma models, with pagination and cross-night resume. It is the strongest thing in the repo. |

Two of its open tasks are also done: `WorkspaceSettings` exists in the schema (TASK-1), and portal
orders are Prisma-backed (TASK-2).

Its claim that **staging deploy is RED on missing `STAGING_SSH_*` secrets** was not re-verified in
this pass — treat it as unconfirmed. Note separately that `deploy-staging.yml` and
`deploy-production.yml` both invoke `./deployment/scripts/smoke-tests.sh`, and `deployment/` does
not exist in this repo.

---

## 3. What is production-grade, what is not

| Area | Status | Evidence |
| --- | --- | --- |
| **Database connectivity** | **BROKEN in production** | Section 0 |
| Cin7 Omni sync | Production-grade | `cin7-omni.ts`, 12 Prisma models, resumable across nights |
| Auth layer and RBAC | Production-grade in code | `src/middleware.ts` deny-by-default with an explicit allowlist; not verifiable live while login is down |
| Unit test suite | Production-grade | 377 passing |
| CI quality gate | Production-grade | lint, type-check, coverage, build — all enforced |
| Scheduled crons | Production-grade **as of 2026-08-07** | 8 of 17 were 501 stubs and were removed; `validate-vercel-crons.js` blocks their return |
| Design tokens | Single source **as of 2026-08-07** | `globals.css`; orphaned `design-system.css` deleted. See `docs/design-system.md` |
| Accessibility | **Failing** | 23 contrast violations on `/`; see `docs/design-system.md` |
| Core Web Vitals | **Failing** | LCP 3195ms vs 2500ms budget |
| Webhook retry, autonomous ops, health-score refresh, quote-expiry alerts, onboarding emails, auto-reorder | **Not built** | Their endpoints returned 501 and were removed. They were never running |
| AP2 agent payments (10 routes), HeyGen (5 routes) | **Not built** | Hard 501 via `notImplementedResponse` |
| Marketplace / multi-channel | **Demo-grade** | Ships a "Demo Mode — all channels running with mock data" banner in production |
| Bank Feeds, Workflows, AI Assistant, Billing | **Shipped disabled** | `comingSoon: true` in `src/components/layout/sidebar.tsx` |
| Staging deploy | Unknown | Previously red; not re-verified. `deployment/` referenced by the workflow does not exist |

---

## 4. Metrics that must not be cited

These appear in earlier documents and are either false or unverifiable. Listed so that finding one
in an old file reads as a red flag rather than a source:

- "97% production-ready", "Platform readiness 95/100"
- "823 automated tests, all passing" — the real figure is 377 passing, 2 skipped
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
2. **Fix the 23 contrast violations.** Use the `--muted-foreground` token instead of the 165 raw
   `text-zinc-400/500/600` classes. `npm run test:e2e` names the failing nodes on every run.
3. **Bring LCP under 2500ms** and clear the other five Lighthouse failures. Once green,
   `lighthouse-agentic.yml` can drop `continue-on-error` and become a real gate — it is left
   non-blocking today only because a red blocking gate gets routed around rather than fixed.
4. **Re-verify the staging deploy**, and either restore `deployment/scripts/smoke-tests.sh` or
   remove the workflow steps that call it.
5. **Decide the fate of the not-built surface** — AP2, HeyGen, marketplace mock mode, and the four
   `comingSoon` nav items. Shipping a large surface the product cannot stand behind is the main
   thing separating this from a product that demos without caveats.
6. **Correct `CCW-Product-Report.md`** — see section 6.

---

## 6. The client-facing report is wrong

`docs/CCW-Product-Report.md` and its PDF are what CCW holds. As of 2026-08-07 they still state:

- "823 automated tests all passing" — actual is 377 passing, 2 skipped
- Setup instructions telling CCW staff to enter Cin7, Xero and Shopify credentials **into a Railway
  backend**. There is no Railway backend in this repo, `API_UPSTREAM_URL` is not in
  `.env.example`, and following those instructions configures nothing
- An architecture diagram showing a Vercel frontend plus a Railway FastAPI backend plus Supabase.
  That FastAPI tier is the one the removed 501 proxy routes were pointing at
- A cron table listing seven endpoints removed for returning 501

Reissuing it is customer-facing and should not go out without the owner reading it first.
