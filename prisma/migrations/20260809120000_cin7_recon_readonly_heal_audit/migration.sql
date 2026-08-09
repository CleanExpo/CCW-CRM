-- Read-only recon snapshots + explicit heal/prune audit (Toby preconditions)

ALTER TABLE "cin7_recon_runs"
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'acceptance',
  ADD COLUMN IF NOT EXISTS "immutable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "cin7_recon_runs_owner_user_id_mode_checked_at_idx"
  ON "cin7_recon_runs"("owner_user_id", "mode", "checked_at" DESC);

CREATE TABLE IF NOT EXISTS "cin7_heal_audit_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "action_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "created_by_user_id" UUID,
  "healed_total" INTEGER NOT NULL DEFAULT 0,
  "deleted_total" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reverted_at" TIMESTAMP(3),
  "reverted_by_user_id" UUID,
  CONSTRAINT "cin7_heal_audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_heal_audit_runs_owner_created_idx"
  ON "cin7_heal_audit_runs"("owner_user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "cin7_heal_audit_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "heal_run_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "record_key" TEXT NOT NULL,
  "before_json" JSONB NOT NULL,
  "after_json" JSONB,
  "reverted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_heal_audit_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_heal_audit_rows_heal_run_id_idx"
  ON "cin7_heal_audit_rows"("heal_run_id");

CREATE INDEX IF NOT EXISTS "cin7_heal_audit_rows_owner_entity_idx"
  ON "cin7_heal_audit_rows"("owner_user_id", "entity_type");

DO $$ BEGIN
  ALTER TABLE "cin7_heal_audit_rows"
    ADD CONSTRAINT "cin7_heal_audit_rows_heal_run_id_fkey"
    FOREIGN KEY ("heal_run_id") REFERENCES "cin7_heal_audit_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
