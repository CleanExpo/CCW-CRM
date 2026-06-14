-- UNI-2111: durable workspace company settings
CREATE TABLE IF NOT EXISTS "workspace_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'My Company',
  "slug" TEXT NOT NULL DEFAULT 'my-company',
  "trading_name" TEXT,
  "abn" TEXT,
  "acn" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_settings_workspace_id_key"
  ON "workspace_settings"("workspace_id");

-- UNI-2113: POS bulk reconciliation audit trail
CREATE TABLE IF NOT EXISTS "reconciliation_match_audit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "matched_by_user_id" UUID NOT NULL,
  "bank_feed_id" UUID NOT NULL,
  "pos_transaction_id" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "failure_reason" TEXT,
  "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_match_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reconciliation_match_audit_matched_by_user_id_idx"
  ON "reconciliation_match_audit"("matched_by_user_id");
CREATE INDEX IF NOT EXISTS "reconciliation_match_audit_bank_feed_id_idx"
  ON "reconciliation_match_audit"("bank_feed_id");
CREATE INDEX IF NOT EXISTS "reconciliation_match_audit_pos_transaction_id_idx"
  ON "reconciliation_match_audit"("pos_transaction_id");
