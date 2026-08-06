-- Checkpointed sync runs + fail-closed reconciliation tables

ALTER TABLE "cin7_sync_runs"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "last_committed_page" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_page" INTEGER,
  ADD COLUMN IF NOT EXISTS "failed_page" INTEGER,
  ADD COLUMN IF NOT EXISTS "failure_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "pages_fetched" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);

ALTER TABLE "cin7_sync_runs"
  ALTER COLUMN "records_processed" SET DEFAULT 0,
  ALTER COLUMN "duration_ms" SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS "cin7_sync_runs_owner_user_id_status_idx"
  ON "cin7_sync_runs"("owner_user_id", "status");

CREATE TABLE IF NOT EXISTS "cin7_sync_job_logs" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "run_id" UUID,
  "level" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "page" INTEGER,
  "http_status" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_sync_job_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_sync_job_logs_owner_entity_created_idx"
  ON "cin7_sync_job_logs"("owner_user_id", "entity_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "cin7_sync_job_logs_run_id_idx"
  ON "cin7_sync_job_logs"("run_id");

ALTER TABLE "cin7_sync_job_logs"
  DROP CONSTRAINT IF EXISTS "cin7_sync_job_logs_run_id_fkey";
ALTER TABLE "cin7_sync_job_logs"
  ADD CONSTRAINT "cin7_sync_job_logs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "cin7_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "cin7_nightly_sync_ledger" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "overall_status" TEXT NOT NULL,
  "entity_results" JSONB NOT NULL,
  "consecutive_complete_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_nightly_sync_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_nightly_sync_ledger_owner_started_idx"
  ON "cin7_nightly_sync_ledger"("owner_user_id", "started_at" DESC);

CREATE TABLE IF NOT EXISTS "cin7_recon_runs" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "blocked_reason" TEXT,
  "optix_complete" BOOLEAN NOT NULL DEFAULT false,
  "cin7_complete" BOOLEAN NOT NULL DEFAULT false,
  "missing_count" INTEGER NOT NULL DEFAULT 0,
  "extra_count" INTEGER NOT NULL DEFAULT 0,
  "linked_count" INTEGER NOT NULL DEFAULT 0,
  "field_mismatch_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_recon_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_recon_runs_owner_checked_idx"
  ON "cin7_recon_runs"("owner_user_id", "checked_at" DESC);

CREATE INDEX IF NOT EXISTS "cin7_recon_runs_owner_status_idx"
  ON "cin7_recon_runs"("owner_user_id", "status");

CREATE TABLE IF NOT EXISTS "cin7_catalog_snapshots" (
  "id" UUID NOT NULL,
  "recon_run_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "record_count" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "complete" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_catalog_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cin7_catalog_snapshots_recon_entity_key"
  ON "cin7_catalog_snapshots"("recon_run_id", "entity_type");

CREATE INDEX IF NOT EXISTS "cin7_catalog_snapshots_owner_entity_idx"
  ON "cin7_catalog_snapshots"("owner_user_id", "entity_type");

ALTER TABLE "cin7_catalog_snapshots"
  DROP CONSTRAINT IF EXISTS "cin7_catalog_snapshots_recon_run_id_fkey";
ALTER TABLE "cin7_catalog_snapshots"
  ADD CONSTRAINT "cin7_catalog_snapshots_recon_run_id_fkey"
  FOREIGN KEY ("recon_run_id") REFERENCES "cin7_recon_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "cin7_recon_exceptions" (
  "id" UUID NOT NULL,
  "recon_run_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "cin7_id" TEXT NOT NULL,
  "label" TEXT,
  "field_diffs" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_recon_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_recon_exceptions_recon_entity_idx"
  ON "cin7_recon_exceptions"("recon_run_id", "entity_type");

CREATE INDEX IF NOT EXISTS "cin7_recon_exceptions_owner_entity_reason_idx"
  ON "cin7_recon_exceptions"("owner_user_id", "entity_type", "reason");

ALTER TABLE "cin7_recon_exceptions"
  DROP CONSTRAINT IF EXISTS "cin7_recon_exceptions_recon_run_id_fkey";
ALTER TABLE "cin7_recon_exceptions"
  ADD CONSTRAINT "cin7_recon_exceptions_recon_run_id_fkey"
  FOREIGN KEY ("recon_run_id") REFERENCES "cin7_recon_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
