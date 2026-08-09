-- Security controls: MFA + Stripe payment audit fields

ALTER TABLE "app_users"
  ADD COLUMN IF NOT EXISTS "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totp_secret_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "totp_verified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "app_user_mfa_recovery_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_user_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "app_user_mfa_recovery_codes_user_id_idx"
  ON "app_user_mfa_recovery_codes"("user_id");

DO $$ BEGIN
  ALTER TABLE "app_user_mfa_recovery_codes"
    ADD CONSTRAINT "app_user_mfa_recovery_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoice_payments"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_stripe_event_id_key"
  ON "invoice_payments"("stripe_event_id");

ALTER TABLE "sales_payments"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "stripe_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "sales_payments_stripe_event_id_key"
  ON "sales_payments"("stripe_event_id");
