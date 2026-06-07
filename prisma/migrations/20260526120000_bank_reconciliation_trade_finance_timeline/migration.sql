-- Bank reconciliation workbench, trade finance, unified timeline foundations

ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'AUD';
ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "cdr_account_id" TEXT;
ALTER TABLE "bank_accounts" ADD COLUMN IF NOT EXISTS "last_feed_sync_at" TIMESTAMP(3);

ALTER TABLE "email_threads" ADD COLUMN IF NOT EXISTS "customer_id" UUID;
CREATE INDEX IF NOT EXISTS "email_threads_customer_id_idx" ON "email_threads"("customer_id");
DO $$ BEGIN
  ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "raw_narration" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "review_status" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "suggested_action" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "confidence_score" DOUBLE PRECISION;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "confidence_reason" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "matched_invoice_id" UUID;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "matched_purchase_order_id" UUID;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "gst_category" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "account_category" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "reconciled_by" UUID;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMP(3);
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "xero_export_status" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "xero_export_ref" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "external_feed_id" TEXT;
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "bank_feed_transactions_status_idx" ON "bank_feed_transactions"("status");
CREATE INDEX IF NOT EXISTS "bank_feed_transactions_matched_invoice_id_idx" ON "bank_feed_transactions"("matched_invoice_id");

DO $$ BEGIN
  ALTER TABLE "bank_feed_transactions" ADD CONSTRAINT "bank_feed_transactions_matched_invoice_id_fkey"
    FOREIGN KEY ("matched_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_feed_transactions" ADD CONSTRAINT "bank_feed_transactions_matched_purchase_order_id_fkey"
    FOREIGN KEY ("matched_purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_feed_transactions_bank_account_id_external_feed_id_key"
  ON "bank_feed_transactions"("bank_account_id", "external_feed_id");

CREATE TABLE IF NOT EXISTS "bank_reconciliation_allocations" (
  "id" UUID NOT NULL,
  "feed_transaction_id" UUID NOT NULL,
  "allocation_type" TEXT NOT NULL,
  "target_id" UUID,
  "amount" DOUBLE PRECISION NOT NULL,
  "gst_category" TEXT,
  "account_code" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_reconciliation_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_reconciliation_allocations_feed_transaction_id_idx"
  ON "bank_reconciliation_allocations"("feed_transaction_id");

DO $$ BEGIN
  ALTER TABLE "bank_reconciliation_allocations" ADD CONSTRAINT "bank_reconciliation_allocations_feed_transaction_id_fkey"
    FOREIGN KEY ("feed_transaction_id") REFERENCES "bank_feed_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bank_reconciliation_audit" (
  "id" UUID NOT NULL,
  "feed_transaction_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "performed_by" UUID NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_reconciliation_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_reconciliation_audit_feed_transaction_id_idx"
  ON "bank_reconciliation_audit"("feed_transaction_id");
CREATE INDEX IF NOT EXISTS "bank_reconciliation_audit_created_at_idx"
  ON "bank_reconciliation_audit"("created_at");

DO $$ BEGIN
  ALTER TABLE "bank_reconciliation_audit" ADD CONSTRAINT "bank_reconciliation_audit_feed_transaction_id_fkey"
    FOREIGN KEY ("feed_transaction_id") REFERENCES "bank_feed_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bank_reconciliation_rules" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "match_pattern" TEXT NOT NULL,
  "match_field" TEXT NOT NULL DEFAULT 'description',
  "action_type" TEXT NOT NULL,
  "account_code" TEXT,
  "gst_category" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_reconciliation_rules_owner_user_id_idx"
  ON "bank_reconciliation_rules"("owner_user_id");
CREATE INDEX IF NOT EXISTS "bank_reconciliation_rules_is_active_idx"
  ON "bank_reconciliation_rules"("is_active");

CREATE TABLE IF NOT EXISTS "trade_finance_facilities" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'CBA',
  "name" TEXT NOT NULL,
  "facility_limit" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trade_finance_facilities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_finance_facilities_owner_user_id_idx"
  ON "trade_finance_facilities"("owner_user_id");

CREATE TABLE IF NOT EXISTS "trade_finance_advances" (
  "id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "advance_number" TEXT NOT NULL,
  "supplier_id" UUID,
  "purchase_order_id" UUID,
  "drawdown_date" DATE NOT NULL,
  "maturity_date" DATE NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "principal_amount" DOUBLE PRECISION NOT NULL,
  "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "interest" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "repaid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "security_ref" TEXT,
  "status" TEXT NOT NULL DEFAULT 'drawn',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trade_finance_advances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_finance_advances_owner_user_id_advance_number_key"
  ON "trade_finance_advances"("owner_user_id", "advance_number");
CREATE INDEX IF NOT EXISTS "trade_finance_advances_facility_id_idx"
  ON "trade_finance_advances"("facility_id");
CREATE INDEX IF NOT EXISTS "trade_finance_advances_status_idx"
  ON "trade_finance_advances"("status");
CREATE INDEX IF NOT EXISTS "trade_finance_advances_maturity_date_idx"
  ON "trade_finance_advances"("maturity_date");

DO $$ BEGIN
  ALTER TABLE "trade_finance_advances" ADD CONSTRAINT "trade_finance_advances_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "trade_finance_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trade_finance_advances" ADD CONSTRAINT "trade_finance_advances_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trade_finance_advances" ADD CONSTRAINT "trade_finance_advances_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
