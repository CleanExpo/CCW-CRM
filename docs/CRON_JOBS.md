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

### 1. Environment Variables

Add to `.env.local` (frontend) and backend `.env`:

```env
CRON_SECRET=your-secure-random-string-here
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

### 2. Vercel Configuration

All schedules are defined in `apps/web/vercel.json`. After any changes:

```bash
vercel --prod
```

Cron jobs start running automatically after deployment.

### 3. Required Backend Environment Variables

The backend cron endpoints also depend on:

```env
# Xero integration
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...

# Cin7 integration
CIN7_API_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Security

### Authentication

All cron endpoints verify the `CRON_SECRET` header:

**Frontend (Next.js):**

```typescript
const authHeader = request.headers.get("authorization");
if (authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) {
  return new NextResponse("Unauthorized", { status: 401 });
}
```

**Backend (FastAPI):**

```python
def verify_cron_secret(authorization: str | None = Header(None)) -> bool:
    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        return True  # Development mode
    return authorization == f"Bearer {cron_secret}"
```

### Vercel Protection

Vercel automatically sets the `Authorization` header and restricts cron calls to Vercel infrastructure only.

## Internal Schedulers (Non-Vercel)

### APScheduler — Bank Feed Sync

Located in `apps/backend/src/scheduler/bank_feed_scheduler.py`. Runs inside the FastAPI process:

| Job ID                  | Schedule             | Description                                   |
| ----------------------- | -------------------- | --------------------------------------------- |
| `bank_feed_sync_hourly` | Every hour at :05    | Sync accounts with 1-hour interval            |
| `bank_feed_sync_4hour`  | Every 4 hours at :10 | Sync accounts with 4-hour interval            |
| `bank_feed_sync_daily`  | Daily at 9:00 AM     | Sync accounts with 24-hour interval (default) |

### Workshop Scheduler

Located in `apps/backend/src/services/workshop_scheduler.py`. Event-driven (not cron):

- Service reminders at 90, 30, and 7 days before due date
- Overdue reminders for equipment past service date
- Idempotent design prevents duplicate reminders

## Local Testing

Cron jobs don't run locally. Test them manually:

```bash
# Start dev server
pnpm dev

# Call any cron endpoint
curl http://localhost:3000/api/cron/health-check \\
  -H "Authorization: Bearer your-cron-secret"

# Test backend endpoint directly
curl -X POST http://localhost:8000/api/cron/check-expiring-quotes \\
  -H "Authorization: Bearer your-cron-secret"
```

## Monitoring

### Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your project
2. Deployments → Latest → Functions tab
3. Find cron functions and view execution logs

### On-Demand Health Endpoints

These backend endpoints provide monitoring data without a schedule:

| Endpoint                                 | Method | Description                                              |
| ---------------------------------------- | ------ | -------------------------------------------------------- |
| `/api/cron/xero-token-health`            | GET    | Xero OAuth connection health and expiry times            |
| `/api/cron/webhook-health`               | GET    | Webhook processing stats, reliability rate (target: 99%) |
| `/api/cron/dead-letter-queue`            | GET    | Webhooks that exceeded max retries                       |
| `/api/cron/dead-letter-queue/{id}/retry` | POST   | Manually retry a dead-letter webhook                     |

## Adding New Cron Jobs

### 1. Create Backend Endpoint (if needed)

```python
# apps/backend/src/api/routes/cron_jobs.py
@router.post("/my-new-task")
async def my_new_task(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Task logic here
    return {"status": "success"}
```

### 2. Create Frontend Route

```typescript
// apps/web/app/api/cron/my-new-task/route.ts
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(\`\${backendUrl}/api/cron/my-new-task\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${process.env.CRON_SECRET}\`,
      },
    });

    const data = await response.json();
    logger.info("My new task cron", { ...data });
    return NextResponse.json({ success: response.ok, ...data });
  } catch (error) {
    logger.error("My new task cron error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### 3. Add to vercel.json

```json
{
  "path": "/api/cron/my-new-task",
  "schedule": "0 */6 * * *"
}
```

### 4. Deploy

```bash
vercel --prod
```

## File Reference

| File                                                | Purpose                                  |
| --------------------------------------------------- | ---------------------------------------- |
| `apps/web/vercel.json`                              | Vercel cron schedule configuration       |
| `apps/web/app/api/cron/*/route.ts`                  | Frontend cron route handlers (13 routes) |
| `apps/backend/src/api/routes/cron_jobs.py`          | Backend cron endpoint implementations    |
| `apps/backend/src/scheduler/bank_feed_scheduler.py` | APScheduler bank feed sync               |
| `apps/backend/src/services/workshop_scheduler.py`   | Workshop service reminder scheduler      |
| `docs/CRON_JOBS.md`                                 | This documentation                       |
