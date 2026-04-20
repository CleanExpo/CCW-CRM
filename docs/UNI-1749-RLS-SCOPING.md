# UNI-1749 — RLS tightening (scoping, not a PR)

**Status**: SCOPED, NOT SHIPPED. Needs Phill's intent confirmation before any migration ships.
**Why scoped-not-shipped**: Demo is in 2 days. RLS policy changes can blank the entire app if misconfigured. Per the PROGRESS.md halt rule: _"A smoke test returns a failure that requires schema/data knowledge only Phill has (rare — document + skip)."_ This qualifies.

---

## What UNI-1749 probably wants

The ticket title is "RLS tightening". Based on a static audit of every migration in `supabase/migrations/*.sql`, here's what's currently permissive:

### Every ERP table has `USING (true)` for authenticated users

In `supabase/migrations/20260213100001_erp_permissions.sql` (lines 33–47):

- `organizations` — SELECT to authenticated: `USING (true)`
- `products` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`
- `customers` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`
- `orders` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`
- `order_items` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`
- `quotes` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`
- `quote_items` — SELECT + ALL to authenticated: `USING (true) WITH CHECK (true)`

Translation: **any authenticated PostgREST user can read and write every row in every table, regardless of org.**

### Other permissive policies found

- `supabase/migrations/20260106000002_add_rls_policies.sql` — 6 `USING (true)` policies on contractor tables
- `supabase/migrations/20260331_010_au_privacy_compliance.sql` — 4 `USING (true)` policies on privacy/compliance tables
- `supabase/migrations/00000000000004_audit_evidence.sql` — 7 `USING (TRUE)` policies on audit tables
- `supabase/migrations/00000000000010_analytics.sql` — 1 `USING (true)` on analytics
- `supabase/migrations/20251230050841_agent_task_queue.sql` — 1 `USING (true)` on agent tasks

## Why this may or may not be a real problem

Migration `20260331190003_fix_rls_users_table.sql` contains an explicit architectural decision:

> **Decision: Single-tenant internal tool — multi-tenancy (UNI-1700–1704) not needed.**
>
> App uses direct DATABASE_URL (postgres role) so unaffected by RLS.

So CCW is **single-tenant** and the FastAPI backend connects as the `postgres` superuser, which bypasses RLS entirely. The only code paths that hit RLS are:

1. Direct PostgREST API calls (e.g., from the Supabase JS client on the frontend) — **if any**
2. Supabase Edge Functions using `supabaseClient`
3. Anyone with a leaked anon/authenticated JWT querying PostgREST directly

## Risk matrix

| Option                                                              | Blast radius                                                | Demo risk                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| **A. Do nothing.** Ship as-is for the demo.                         | Zero app impact. Low security hardening.                    | 0                                                             |
| **B. Tighten to `auth.uid() IS NOT NULL`** (any logged-in)          | Blocks anon JWT, no org isolation.                          | Low                                                           |
| **C. Tighten to `organization_id = (auth.jwt()->>'org_id')::uuid`** | Requires JWT claim wiring. Breaks if claim missing.         | **HIGH**                                                      |
| **D. Tighten to `service_role` only** (PostgREST deny-all)          | App unaffected (uses postgres role). Blocks all JS clients. | **MEDIUM** — breaks if frontend uses Supabase JS for any read |

## My recommendation for the demo window

**Option A (do nothing for UNI-1749) until after the 2026-04-20 demo.** Reasoning:

1. CCW is single-tenant for the demo. No org-leakage concern in practice.
2. The FastAPI backend uses the postgres role → RLS doesn't apply to app queries.
3. Options C and D carry real risk of silently blanking queries mid-demo.
4. The right time to do this is after the demo, when we can run a proper test plan and canary it.

**After the demo (Day 3+)**: Run the Supabase security advisor (needs MCP re-auth), enumerate every table without a deny-default, then ship a single consolidated migration that moves everything to Option B or D.

## If Phill says "ship it anyway"

Here's the migration I'd write for Option B (the safest tightening that keeps the frontend working):

```sql
-- 20260418_rls_tighten_erp_authenticated.sql
-- UNI-1749: tighten ERP table policies from USING (true) to auth.uid() IS NOT NULL
-- Blocks anon JWT queries; does NOT add org isolation (single-tenant is acceptable for now).

BEGIN;

-- organizations
DROP POLICY IF EXISTS "authenticated_read_organizations" ON organizations;
CREATE POLICY "authenticated_read_organizations" ON organizations
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- products
DROP POLICY IF EXISTS "authenticated_read_products" ON products;
DROP POLICY IF EXISTS "authenticated_write_products" ON products;
CREATE POLICY "authenticated_read_products" ON products
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write_products" ON products
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- customers
DROP POLICY IF EXISTS "authenticated_read_customers" ON customers;
DROP POLICY IF EXISTS "authenticated_write_customers" ON customers;
CREATE POLICY "authenticated_read_customers" ON customers
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write_customers" ON customers
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- orders, order_items, quotes, quote_items — same pattern
-- (repeat for each table)

COMMIT;
```

**Before shipping Option B**, Phill must confirm:

1. The frontend does NOT read/write these tables directly via the Supabase JS client 
