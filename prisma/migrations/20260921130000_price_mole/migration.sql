-- UNI-2751: Price Mole. Additive only.

CREATE TABLE "competitor_products" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "competitor" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "competitor_sku" TEXT,
    "product_id" UUID,
    "match_status" TEXT NOT NULL DEFAULT 'suggested',
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competitor_products_owner_user_id_url_key" ON "competitor_products"("owner_user_id", "url");
CREATE INDEX "competitor_products_owner_user_id_idx" ON "competitor_products"("owner_user_id");
CREATE INDEX "competitor_products_product_id_idx" ON "competitor_products"("product_id");

ALTER TABLE "competitor_products"
  ADD CONSTRAINT "competitor_products_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "competitor_prices" (
    "id" UUID NOT NULL,
    "competitor_product_id" UUID NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "source" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competitor_prices_competitor_product_id_captured_at_idx" ON "competitor_prices"("competitor_product_id", "captured_at" DESC);

ALTER TABLE "competitor_prices"
  ADD CONSTRAINT "competitor_prices_competitor_product_id_fkey"
  FOREIGN KEY ("competitor_product_id") REFERENCES "competitor_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "competitor_capture_runs" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "trigger" TEXT NOT NULL,
    "page_budget" INTEGER NOT NULL,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "stopped_reason" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "competitor_capture_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competitor_capture_runs_owner_user_id_started_at_idx" ON "competitor_capture_runs"("owner_user_id", "started_at" DESC);
