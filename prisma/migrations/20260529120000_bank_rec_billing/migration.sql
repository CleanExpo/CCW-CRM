-- Bank reconciliation: trade finance advance matching
ALTER TABLE "bank_feed_transactions" ADD COLUMN IF NOT EXISTS "matched_advance_id" UUID;

DO $$ BEGIN
  ALTER TABLE "bank_feed_transactions"
    ADD CONSTRAINT "bank_feed_transactions_matched_advance_id_fkey"
    FOREIGN KEY ("matched_advance_id") REFERENCES "trade_finance_advances"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "bank_feed_transactions_matched_advance_id_idx"
  ON "bank_feed_transactions"("matched_advance_id");

-- Workspace billing (CCW Online subscription management)
CREATE TABLE IF NOT EXISTS "workspace_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'professional',
  "status" TEXT NOT NULL DEFAULT 'trial',
  "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
  "price_cents" INTEGER NOT NULL DEFAULT 0,
  "trial_ends_at" TIMESTAMP(3),
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "canceled_at" TIMESTAMP(3),
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "last_payment_failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_subscriptions_workspace_id_key"
  ON "workspace_subscriptions"("workspace_id");

CREATE TABLE IF NOT EXISTS "workspace_payment_methods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "brand" TEXT NOT NULL DEFAULT 'visa',
  "last4" TEXT NOT NULL,
  "exp_month" INTEGER NOT NULL,
  "exp_year" INTEGER NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "external_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_payment_methods_workspace_id_idx"
  ON "workspace_payment_methods"("workspace_id");

DO $$ BEGIN
  ALTER TABLE "workspace_payment_methods"
    ADD CONSTRAINT "workspace_payment_methods_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspace_subscriptions"("workspace_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workspace_billing_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "amount_due" INTEGER NOT NULL,
  "amount_paid" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AUD',
  "status" TEXT NOT NULL DEFAULT 'open',
  "hosted_invoice_url" TEXT,
  "invoice_pdf" TEXT,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_billing_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workspace_billing_invoices_workspace_id_idx"
  ON "workspace_billing_invoices"("workspace_id");

DO $$ BEGIN
  ALTER TABLE "workspace_billing_invoices"
    ADD CONSTRAINT "workspace_billing_invoices_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspace_subscriptions"("workspace_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
