-- CreateTable
CREATE TABLE "product_location_stock" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_location_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "from_location" TEXT NOT NULL,
    "to_location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_location_stock_product_id_location_key" ON "product_location_stock"("product_id", "location");

-- CreateIndex
CREATE INDEX "product_location_stock_product_id_idx" ON "product_location_stock"("product_id");

-- CreateIndex
CREATE INDEX "stock_transfers_owner_user_id_idx" ON "stock_transfers"("owner_user_id");

-- CreateIndex
CREATE INDEX "stock_transfers_product_id_idx" ON "stock_transfers"("product_id");

-- AddForeignKey
ALTER TABLE "product_location_stock" ADD CONSTRAINT "product_location_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
