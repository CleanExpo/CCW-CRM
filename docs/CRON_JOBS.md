# Cron Jobs — CCW ERP/CRM

Scheduled tasks run on Vercel Cron against Next.js Route Handlers in this repo.

## Architecture

There is **one tier**, not two. Every cron path resolves to a Route Handler under
`src/app/api/cron/` that verifies `CRON_SECRET` and does the work itself against Postgres and the
external integration APIs.

1. **Vercel Cron** triggers the Route Handler on schedule
2. The handler checks `Authorization: Bearer $CRON_SECRET` and returns 401 otherwise
3. The handler executes the work directly and returns results
4. Results are logged to Vercel

> **Historical note.** Until 2026-08-07 this document described a second tier — a FastAPI backend
> the routes proxied to. That service is not deployed and `API_UPSTREAM_URL` is not configured, so
> the eight routes that proxied to it returned HTTP 501 every time Vercel called them. They have
> been removed from `vercel.json` and deleted. `scripts/ci/validate-vercel-crons.js` now fails CI
> if any scheduled path resolves to a stub, so this cannot recur silently.

## Complete Cron Schedule

Enforced against `vercel.json` by `node scripts/ci/validate-vercel-crons.js`. AEST is Brisbane
(UTC+10, no daylight saving).

### High-Frequency (every 5–15 minutes)

| Schedule       | Endpoint                        | Description                                           |
| -------------- | ------------------------------- | ----------------------------------------------------- |
| `*/5 * * * *`  | `/api/cron/health-check`        | Liveness probe, latency measurement, outage detection |
| `*/15 * * * *` | `/api/cron/refresh-xero-tokens` | Refresh Xero OAuth tokens before expiry               |
| `*/15 * * * *` | `/api/cron/check-sla-breaches`  | UNI-174 ST-4: scan for SLA breaches, fire escalations |

### Daily

| Schedule (UTC) | AEST     | Endpoint                                   | Description                                             |
| -------------- | -------- | ------------------------------------------ | ------------------------------------------------------- |
| `0 2 * * *`    | 12:00 PM | `/api/cron/cleanup-old-runs`               | Delete completed/failed agent runs older than 30 days   |
| `0 6 * * *`    | 4:00 PM  | `/api/cron/sync-bank-feeds`                | Pull bank feed transactions                             |
| `0 9 * * *`    | 7:00 PM  | `/api/cron/daily-report`                   | Daily summary of agent activity and success rates       |
| `0 10 * * *`   | 8:00 PM  | `/api/cron/check-invoice-overdue`          | Overdue invoice notifications                           |
| `0 11 * * *`   | 9:00 PM  | `/api/cron/check-trade-finance-maturities` | Trade finance maturity alerts                           |
| `0 11 * * *`   | 9:00 PM  | `/api/cron/nightly-full-sync`              | Cin7 full sync, resumable across nights per entity      |

**Total: 9 scheduled cron jobs**

### Removed 2026-08-07 — not running, treat as unbuilt

`retry-failed-webhooks` · `run-autonomous-ops` · `refresh-health-scores` ·
`check-expiring-quotes` · `process-onboarding-emails` · `shadow-sync-cin7` · `shadow-sync-xero` ·
`auto-reorder-inventory`

The Cin7 capability is covered by `nightly-full-sync`. The other seven have no replacement:
webhook retry, autonomous ops, CRM health-score refresh, quote-expiry alerts, onboarding email
sequences and auto-reorder are **not happening today** and were not happening before removal
either.

## Setup

### 1. Environment variables

Set on the **Vercel project**, and in `.env.local` for local work:

```env
CRON_SECRET=your-secure-random-string-here
```

Generate one with `openssl rand -base64 32`.

The jobs additionally need whatever their integration requires:

- Xero — `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
- Cin7 — **either** Omni (`CIN7_OMNI_USERNAME` + `CIN7_OMNI_API_KEY`, or
  `CIN7_OMNI_CONNECTION_KEY`) **or** Core (`CIN7_CORE_ACCOUNT_ID` +
  `CIN7_CORE_APPLICATION_KEY`). `src/lib/integrations/diagnostics.ts` is the authority on which
  combinations count as configured. A bare `CIN7_API_KEY` is read by nothing — earlier revisions
  of this document named it and following them configured no credential at all.
- A database connection — `DATABASE_URL`, or the `DB_HOST`/`DB_USER`/`DB_PASSWORD` triple resolved
  by `src/lib/db/database-env.ts`

> As of 2026-08-07 the production deployment has **no** database connection configured, so every
> database-backed cron fails. See section 0 of `docs/PROJECT-STATUS.md`.

### 2. Schedules

Schedules live in `vercel.json` at the repository root. `node scripts/ci/validate-vercel-crons.js`
fails CI if a scheduled path has no Route Handler, exports neither GET nor POST, or resolves —
directly or through its imports — to a 501 stub.

## Security

Every cron handler authenticates through one shared guard:

```typescript
import { cronAuthFailure } from '@/lib/api/cron-auth';

export async function GET(request: Request) {
  const unauthorized = cronAuthFailure(request);
  if (unauthorized) return unauthorized;
  // ...
}
```

An `x-cron-secret` header is **not** accepted; several older runbooks told operators to send one,
and every such request returns 401.

### Why this is not written inline

Until 2026-08-07 each handler inlined the comparison:

```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { /* 401 */ }
```

That is **fail-open**. When `CRON_SECRET` is unset the template evaluates to the literal string
`"Bearer undefined"`, so a request sending exactly that header is authorised. Twelve handlers
carried the pattern. An independent reviewer demonstrated it; `src/lib/api/__tests__/cron-auth.test.ts`
now pins the behaviour, and `scripts/ci/validate-vercel-crons.js` fails CI if the inline form
reappears in any scheduled route.

`cronAuthFailure` fails closed: a missing or blank `CRON_SECRET` returns **503** for every request,
distinct from the **401** a wrong credential gets, so a misconfigured deployment is not mistaken
for an attacker. The comparison is constant-time.

Earlier revisions of this document also showed a FastAPI helper returning `True` when the secret was
missing, described as "development mode". Same defect, different language. Do not reintroduce it in
any form.

Vercel sets the `Authorization` header itself and restricts cron invocations to its own
infrastructure.

## Local testing

Cron jobs do not run against a local dev server on a schedule. Invoke them directly:

```bash
npm run dev

curl http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer $CRON_SECRET"
```

Against production, derive the endpoint list from `vercel.json` rather than maintaining it by hand
— see the loop in `docs/production-smoke-test.md` §11.

A **501** means the route is a stub that cannot do its job — the failure this document exists to
prevent. A **401** means `CRON_SECRET` is wrong locally, not that the endpoint is broken.

## Monitoring

Vercel Dashboard → the project → **Cron Jobs** tab shows the last execution and status for each
schedule. Function logs are under Deployments → Latest → Functions. Runtime errors are also
retrievable through the Vercel API.

## Adding a new cron job

There is one tier. Write a Route Handler that does the work; do not proxy to another service.

1. Create `src/app/api/cron/<name>/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Do the work here, against Postgres and the integration APIs directly.
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('<name> cron error', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

2. Add it to the `crons` array in `vercel.json`.
3. Run `node scripts/ci/validate-vercel-crons.js` before pushing.
4. Update the schedule table at the top of this file.

## File reference

| File | Purpose |
| --- | --- |
| `vercel.json` | Vercel cron schedule configuration |
| `src/app/api/cron/*/route.ts` | Cron Route Handlers (9 scheduled) |
| `scripts/ci/validate-vercel-crons.js` | Fails CI when a scheduled cron cannot run |
| `src/lib/db/database-env.ts` | Database connection resolution |
| `docs/CRON_JOBS.md` | This documentation |

Paths under `apps/web/` and `apps/backend/` appeared in earlier revisions of this table. They do
not exist in this repository — the FastAPI tier they referred to is the one whose absence made
eight scheduled jobs return 501 for months.
