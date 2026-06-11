-- Migration: add_reconciliation_match_audit
-- Context: ReconciliationMatchAudit model was added to schema.prisma in PR #206
-- but the corresponding migration file was never created.
-- This migration creates the missing table.

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
