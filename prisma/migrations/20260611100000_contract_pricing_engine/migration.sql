-- Contract Pricing Engine: PriceList + CustomerPriceTier
-- Board-approved feature: "Customer Contract Pricing and Price Tier Engine"
-- PR: feat/contract-pricing-for-rana

-- PriceList: named tier templates (Trade-A, Trade-B, Retail, …)
-- priceOverrides: JSON array of { product_id, unit_price }
-- volumeBreaks:   JSON array of { product_id, min_qty, unit_price }
CREATE TABLE "price_lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_overrides" JSONB NOT NULL DEFAULT '[]',
    "volume_breaks" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_lists_owner_user_id_name_key"
    ON "price_lists"("owner_user_id", "name");

CREATE INDEX "price_lists_owner_user_id_idx"
    ON "price_lists"("owner_user_id");

-- CustomerPriceTier: 0-or-1 PriceList per Customer with optional expiry
CREATE TABLE "customer_price_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_price_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_price_tiers_customer_id_key"
    ON "customer_price_tiers"("customer_id");

CREATE INDEX "customer_price_tiers_owner_user_id_idx"
    ON "customer_price_tiers"("owner_user_id");

CREATE INDEX "customer_price_tiers_price_list_id_idx"
    ON "customer_price_tiers"("price_list_id");

ALTER TABLE "customer_price_tiers"
    ADD CONSTRAINT "customer_price_tiers_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_price_tiers"
    ADD CONSTRAINT "customer_price_tiers_price_list_id_fkey"
    FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
