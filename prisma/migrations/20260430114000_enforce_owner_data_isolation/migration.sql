-- Enforce per-user data ownership for core business entities.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "owner_user_id" UUID;

-- Backfill existing rows to the first app user so legacy data remains reachable.
-- IMPORTANT: run this migration only after at least one user exists.
WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "customers" c
SET "owner_user_id" = owner.id
FROM owner
WHERE c."owner_user_id" IS NULL;

WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "products" p
SET "owner_user_id" = owner.id
FROM owner
WHERE p."owner_user_id" IS NULL;

WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "orders" o
SET "owner_user_id" = owner.id
FROM owner
WHERE o."owner_user_id" IS NULL;

WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "quotes" q
SET "owner_user_id" = owner.id
FROM owner
WHERE q."owner_user_id" IS NULL;

WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "suppliers" s
SET "owner_user_id" = owner.id
FROM owner
WHERE s."owner_user_id" IS NULL;

WITH owner AS (
  SELECT id FROM "app_users" ORDER BY "created_at" ASC LIMIT 1
)
UPDATE "purchase_orders" po
SET "owner_user_id" = owner.id
FROM owner
WHERE po."owner_user_id" IS NULL;

ALTER TABLE "customers" ALTER COLUMN "owner_user_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "owner_user_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "owner_user_id" SET NOT NULL;
ALTER TABLE "quotes" ALTER COLUMN "owner_user_id" SET NOT NULL;
ALTER TABLE "suppliers" ALTER COLUMN "owner_user_id" SET NOT NULL;
ALTER TABLE "purchase_orders" ALTER COLUMN "owner_user_id" SET NOT NULL;

-- Add lookup indexes for scoped API queries.
CREATE INDEX IF NOT EXISTS "customers_owner_user_id_idx" ON "customers"("owner_user_id");
CREATE INDEX IF NOT EXISTS "products_owner_user_id_idx" ON "products"("owner_user_id");
CREATE INDEX IF NOT EXISTS "orders_owner_user_id_idx" ON "orders"("owner_user_id");
CREATE INDEX IF NOT EXISTS "quotes_owner_user_id_idx" ON "quotes"("owner_user_id");
CREATE INDEX IF NOT EXISTS "suppliers_owner_user_id_idx" ON "suppliers"("owner_user_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_owner_user_id_idx" ON "purchase_orders"("owner_user_id");

-- Replace global uniqueness with per-owner uniqueness.
DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "suppliers_supplier_code_key";
DROP INDEX IF EXISTS "purchase_orders_po_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "products_owner_user_id_sku_key"
  ON "products"("owner_user_id", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_owner_user_id_supplier_code_key"
  ON "suppliers"("owner_user_id", "supplier_code");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_owner_user_id_po_number_key"
  ON "purchase_orders"("owner_user_id", "po_number");
