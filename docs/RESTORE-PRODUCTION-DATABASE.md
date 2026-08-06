# Restoring the production database

**Written 2026-08-07.** Every fact below was measured, with the command that produced it.

CCW Online ERP cannot be logged into. This document is the diagnosis and the exact steps to fix
it. It requires credentials, so it is written for a human to execute.

---

## What is actually wrong

Not one thing. Three, and fixing only the first still leaves login broken.

### 1. There is no database connection

```
$ vercel env ls production          # project ccw-crm-web, team unite-group
23 variables. None of: DATABASE_URL, DB_HOST, DB_USER, DB_PASSWORD.
```

`src/lib/db/prisma.ts:53` throws `DATABASE_URL is not configured` because
`getDatabaseConnectionString()` (in `src/lib/db/database-env.ts`) finds neither a `DATABASE_URL`
nor the `DB_HOST`/`DB_USER`/`DB_PASSWORD` triple.

Consequence, from Vercel runtime errors on `prj_oTCifkMVqP1NFoTJFBv6u82JmBYd`:

| Route | Occurrences | First seen |
| --- | --- | --- |
| `/api/cron/refresh-xero-tokens` | 96 | 2026-07-05 |
| `/api/auth/login` | 5 | 2026-08-06 |
| `/api/cron/daily-report` | 1 | 2026-07-07 |
| `/api/cron/cleanup-old-runs` | 1 | 2026-07-07 |
| `/api/cron/health-check` (failing probe) | 288 | 2026-06-16 |

### 2. There is no JWT signing secret

`src/lib/auth/jwt-tokens.ts:4` reads `JWT_SECRET ?? JWT_SECRET_KEY` and
`signAccessToken` throws `JWT_SECRET is not configured` when both are absent. Neither is in the
production environment. **Setting the database alone will not restore login** — it will move the
failure from `prisma.ts:53` to `jwt-tokens.ts`.

### 3. There are no Cin7 credentials

`src/lib/integrations/diagnostics.ts:83-91` requires **either** the Omni pair
(`CIN7_OMNI_USERNAME` + `CIN7_OMNI_API_KEY`, or `CIN7_OMNI_CONNECTION_KEY`) **or** the Core pair
(`CIN7_CORE_ACCOUNT_ID` + `CIN7_CORE_APPLICATION_KEY`). No `CIN7_*` variable exists in production.
The nightly sync — the strongest part of this product — has never had credentials to run with.

---

## Where the data is, is an open question

Do not assume Supabase. Measured across the org's Supabase projects:

```sql
-- pwwwhoaxxtkmowifpuwf ("NodeJS Starter V1")
app_users                 false      customers  true
cin7_sync_runs            false      products   true
workspace_settings        false
_prisma_migrations        false      <- prisma migrate deploy has NEVER run here
```

`customers` and `products` returning true is the control: the query discriminates, so the false
results are real. 77 of the 105 `@@map` targets in `prisma/schema.prisma` are missing from that
project, including `app_users` — the table `/api/auth/login` reads.

`qwoggbbavikzhypzodcr` ("Phills CRM") and `lksfwktwtmyznckodsau` ("Unite-Group") also have no
`app_users`, no `cin7_sync_runs`, no `workspace_settings`.

The repo carries **42 migrations** from `20260417183625_initialize_schema` onward. The absence of
`_prisma_migrations` anywhere means they have not been applied to any Supabase project in this org.

Meanwhile the code targets DigitalOcean: `src/lib/db/database-env.ts` handles libpq SSL
compatibility and the P1011 self-signed-certificate case for DigitalOcean managed Postgres, and
`src/lib/db/prisma.ts:148` says those variables are "only available at runtime on DigitalOcean".
`doctl` is installed but unauthenticated, so that account could not be checked.

---

## Step 1 — settle where the data lives (one command)

```bash
doctl auth init
doctl databases list
```

This is the fork in the road and takes under a minute.

**If a CCW Postgres cluster exists there**, it holds the live data and the fix is purely
configuration — go to Step 2A.

**If it does not**, then CCW-CRM has never had a provisioned database. Login has been failing
since at least 2026-08-06, the Xero cron since 2026-07-05, and the health probe since 2026-06-16,
which is consistent with the ERP never having been in real use. Go to Step 2B.

---

## Step 2A — the database exists on DigitalOcean

Get the connection string from `doctl databases connection <id> --format URI`, then:

```bash
cd /path/to/CCW-CRM
vercel env add DATABASE_URL production      # paste the URI when prompted
vercel env add JWT_SECRET production        # openssl rand -base64 48
```

Use the **connection-pool** URI, not the primary host — serverless functions exhaust direct
connections. Then confirm the schema matches the code before trusting it:

```bash
DATABASE_URL='<uri>' npx prisma migrate status
```

If it reports pending migrations, apply them with `npx prisma migrate deploy`. Do not use
`prisma db push` — it does not record a ledger and will make the next person guess again.

---

## Step 2B — no database exists; provision one

Recommended: a **dedicated** Supabase project for CCW-CRM. Not `NodeJS Starter V1` — that project
holds an unrelated application's tables (Reddit content pillars, recipes, SEO audits) and mixing
CCW's 105 tables into it is how the current confusion started.

```bash
# 1. Create a project in the unite-group Supabase org, region ap-southeast-2 (Sydney)
#    to match the Vercel deployment region syd1.

# 2. Apply the full schema, ledgered:
DATABASE_URL='<transaction-pooler-uri>' npx prisma migrate deploy

# 3. Configure Vercel:
vercel env add DATABASE_URL production      # the pooler URI, port 6543
vercel env add JWT_SECRET production        # openssl rand -base64 48

# 4. Cin7, so the nightly sync can actually run:
vercel env add CIN7_OMNI_USERNAME production
vercel env add CIN7_OMNI_API_KEY production
#    or the Core pair — see src/lib/integrations/diagnostics.ts

# 5. The workspace the scheduled work runs as:
vercel env add CRON_INTEGRATION_USER_ID production
```

`CRON_INTEGRATION_USER_ID` is not optional. Five scheduled handlers read it —
`check-invoice-overdue`, `check-sla-breaches`, `check-trade-finance-maturities`,
`nightly-full-sync` and `sync-bank-feeds` — and `nightly-full-sync/route.ts:23` returns **HTTP 500**
when it is absent. Setting the database and Cin7 credentials without it leaves the nightly sync
failing, just with a different error than before.

Use the **transaction pooler** string (port 6543), never `db.<ref>.supabase.co` directly.

---

## Step 3 — verify, and do not skip the control

Redeploy, then:

```bash
# 1. Login must stop returning 503.
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://ccw-crm-web.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"wrong"}'
# EXPECT 401 (bad credentials reached the database), NOT 503.
# A 401 here is SUCCESS: it proves the query ran.

# 2. Every scheduled cron must return non-501.
#    See docs/production-smoke-test.md §11 — derive the list from vercel.json.

# 3. The authenticated browser suite, which currently cannot run at all:
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
```

**Regenerate the visual baselines on the first green run**, with `--update-snapshots`. The six
committed baselines predate the 2026-08-07 contrast fix and will legitimately differ.

---

## What must not be done

- **Do not hand-write SQL against a shared Supabase project.** The schema is 105 tables with
  foreign keys and enums; `prisma migrate deploy` is the only reproducible path, and it records a
  ledger so the next person does not have to guess.
- **Do not use `prisma db push` against production.** No ledger, no rollback story.
- **Do not set these from an agent session.** They are production credentials.
- **Do not trust a Supabase dashboard tab that was opened for a different account.** It silently
  redirects a `/project/<ref>` URL to its own project, and DDL then succeeds against the wrong
  database with an honest-looking success message. Confirm the ref is still in the URL after the
  page loads, and verify from the API side afterwards.
