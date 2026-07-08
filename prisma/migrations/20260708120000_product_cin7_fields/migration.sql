-- Cin7 product provenance for record-level reconciliation
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cin7_style_code" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cin7_visibility" TEXT;

CREATE INDEX IF NOT EXISTS "products_owner_user_id_cin7_style_code_idx"
  ON "products" ("owner_user_id", "cin7_style_code");
