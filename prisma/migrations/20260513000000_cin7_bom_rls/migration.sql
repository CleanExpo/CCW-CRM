-- RA-3029 — RLS for Cin7 BOM tables.
--
-- Migration 20260512183000_cin7_bom_tables added three new tables
-- (cin7_bom_masters, cin7_bom_components, cin7_production_runs) without
-- the RLS coverage that UNI-1750 established as a CCW-ERP boardroom
-- invariant ("all public tables have RLS enabled"). This migration
-- closes that gap.
--
-- Today's app-layer auth (requireAuthScope + workspaceUserIds in
-- src/lib/db/cin7-bom-service.ts) prevents IDOR via REST routes, BUT
-- there is no defense-in-depth at the database layer. If anyone bypasses
-- the Prisma layer (raw `pg` query, future Supabase Edge Function,
-- future SQL view), RLS is the last line of defense.
--
-- cin7_bom_components has no owner_user_id column, so its policy
-- traverses bom_master_id → cin7_bom_masters.owner_user_id.

-- ── 1. Enable RLS on all three tables ────────────────────────────────────────
ALTER TABLE "cin7_bom_masters"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cin7_bom_components"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cin7_production_runs" ENABLE ROW LEVEL SECURITY;

-- ── 2. cin7_bom_masters — owner-only ─────────────────────────────────────────
CREATE POLICY "cin7_bom_masters_owner_select" ON "cin7_bom_masters"
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "cin7_bom_masters_owner_insert" ON "cin7_bom_masters"
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "cin7_bom_masters_owner_update" ON "cin7_bom_masters"
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "cin7_bom_masters_owner_delete" ON "cin7_bom_masters"
  FOR DELETE USING (owner_user_id = auth.uid());

-- ── 3. cin7_bom_components — derive owner via bom_master_id ─────────────────
CREATE POLICY "cin7_bom_components_owner_select" ON "cin7_bom_components"
  FOR SELECT USING (
    bom_master_id IN (
      SELECT id FROM "cin7_bom_masters" WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "cin7_bom_components_owner_insert" ON "cin7_bom_components"
  FOR INSERT WITH CHECK (
    bom_master_id IN (
      SELECT id FROM "cin7_bom_masters" WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "cin7_bom_components_owner_update" ON "cin7_bom_components"
  FOR UPDATE USING (
    bom_master_id IN (
      SELECT id FROM "cin7_bom_masters" WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bom_master_id IN (
      SELECT id FROM "cin7_bom_masters" WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "cin7_bom_components_owner_delete" ON "cin7_bom_components"
  FOR DELETE USING (
    bom_master_id IN (
      SELECT id FROM "cin7_bom_masters" WHERE owner_user_id = auth.uid()
    )
  );

-- ── 4. cin7_production_runs — owner-only ─────────────────────────────────────
CREATE POLICY "cin7_production_runs_owner_select" ON "cin7_production_runs"
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "cin7_production_runs_owner_insert" ON "cin7_production_runs"
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "cin7_production_runs_owner_update" ON "cin7_production_runs"
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "cin7_production_runs_owner_delete" ON "cin7_production_runs"
  FOR DELETE USING (owner_user_id = auth.uid());

-- ── 5. Service-role bypass note ──────────────────────────────────────────────
-- Supabase service-role JWTs bypass RLS by default. Prisma connects via
-- DATABASE_URL using the postgres role (which has BYPASSRLS), so the
-- existing application layer continues to work unchanged. Any future
-- Edge Function / browser-side Supabase client that uses the anon key
-- will now be correctly constrained to its own workspace's rows.
