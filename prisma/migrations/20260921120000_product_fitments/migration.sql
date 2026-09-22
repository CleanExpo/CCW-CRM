-- UNI-2748: machine-to-consumables and parts map. Additive only.

CREATE TABLE "product_fitments" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "machine_product_id" UUID NOT NULL,
    "fit_product_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "usage_quantity" DOUBLE PRECISION,
    "usage_per" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "evidence" TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_fitments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_fitments_machine_product_id_fit_product_id_key" ON "product_fitments"("machine_product_id", "fit_product_id");
CREATE INDEX "product_fitments_owner_user_id_idx" ON "product_fitments"("owner_user_id");
CREATE INDEX "product_fitments_fit_product_id_idx" ON "product_fitments"("fit_product_id");
CREATE INDEX "product_fitments_status_idx" ON "product_fitments"("status");

ALTER TABLE "product_fitments"
  ADD CONSTRAINT "product_fitments_machine_product_id_fkey"
  FOREIGN KEY ("machine_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_fitments"
  ADD CONSTRAINT "product_fitments_fit_product_id_fkey"
  FOREIGN KEY ("fit_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
