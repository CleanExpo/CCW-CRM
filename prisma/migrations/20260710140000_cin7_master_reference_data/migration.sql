-- Cin7 master reference data tables (Phase 1 reconciliation)

CREATE TABLE "cin7_product_categories" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "cin7_category_id" TEXT NOT NULL,
    "parent_cin7_category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cin7_brands" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cin7_price_lists" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "cin7_price_column" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_price_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cin7_tax_codes" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_tax_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cin7_units_of_measure" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_units_of_measure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cin7_stock_levels" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "cin7_branch_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "branch_name" TEXT,
    "available" INTEGER NOT NULL DEFAULT 0,
    "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
    "incoming" INTEGER NOT NULL DEFAULT 0,
    "open_sales" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cin7_stock_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cin7_product_categories_owner_user_id_cin7_category_id_key" ON "cin7_product_categories"("owner_user_id", "cin7_category_id");
CREATE INDEX "cin7_product_categories_owner_user_id_idx" ON "cin7_product_categories"("owner_user_id");

CREATE UNIQUE INDEX "cin7_brands_owner_user_id_name_key" ON "cin7_brands"("owner_user_id", "name");
CREATE INDEX "cin7_brands_owner_user_id_idx" ON "cin7_brands"("owner_user_id");

CREATE UNIQUE INDEX "cin7_price_lists_owner_user_id_cin7_price_column_key" ON "cin7_price_lists"("owner_user_id", "cin7_price_column");
CREATE INDEX "cin7_price_lists_owner_user_id_idx" ON "cin7_price_lists"("owner_user_id");

CREATE UNIQUE INDEX "cin7_tax_codes_owner_user_id_code_key" ON "cin7_tax_codes"("owner_user_id", "code");
CREATE INDEX "cin7_tax_codes_owner_user_id_idx" ON "cin7_tax_codes"("owner_user_id");

CREATE UNIQUE INDEX "cin7_units_of_measure_owner_user_id_code_key" ON "cin7_units_of_measure"("owner_user_id", "code");
CREATE INDEX "cin7_units_of_measure_owner_user_id_idx" ON "cin7_units_of_measure"("owner_user_id");

CREATE UNIQUE INDEX "cin7_stock_levels_owner_user_id_cin7_branch_id_sku_key" ON "cin7_stock_levels"("owner_user_id", "cin7_branch_id", "sku");
CREATE INDEX "cin7_stock_levels_owner_user_id_sku_idx" ON "cin7_stock_levels"("owner_user_id", "sku");
CREATE INDEX "cin7_stock_levels_owner_user_id_cin7_branch_id_idx" ON "cin7_stock_levels"("owner_user_id", "cin7_branch_id");
