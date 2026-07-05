-- Cin7 contact type on customers (Customer vs Internal).
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cin7_contact_type" TEXT;

-- Cin7 branch master data.
CREATE TABLE IF NOT EXISTS "cin7_branches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "cin7_branch_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "branch_type" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "state" TEXT,
  "post_code" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cin7_branches_owner_user_id_cin7_branch_id_key"
  ON "cin7_branches" ("owner_user_id", "cin7_branch_id");

CREATE INDEX IF NOT EXISTS "cin7_branches_owner_user_id_idx"
  ON "cin7_branches" ("owner_user_id");

-- Cin7 sync run audit log.
CREATE TABLE IF NOT EXISTS "cin7_sync_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "records_processed" INTEGER NOT NULL,
  "skipped" JSONB,
  "duration_ms" INTEGER NOT NULL,
  "source" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cin7_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cin7_sync_runs_owner_user_id_created_at_idx"
  ON "cin7_sync_runs" ("owner_user_id", "created_at" DESC);
