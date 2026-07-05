-- Cin7 contact id for idempotent customer sync (prevents duplicate CRM imports).
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "cin7_contact_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_owner_user_id_cin7_contact_id_key"
  ON "customers" ("owner_user_id", "cin7_contact_id")
  WHERE "cin7_contact_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "customers_owner_user_id_cin7_contact_id_idx"
  ON "customers" ("owner_user_id", "cin7_contact_id");
