-- AlterTable
ALTER TABLE "orders" ADD COLUMN "branch_name" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "branch_name" TEXT;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "product_id" UUID,
    "sku" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movement_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_owner_user_id_occurred_at_idx" ON "stock_movements"("owner_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_owner_user_id_sku_idx" ON "stock_movements"("owner_user_id", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_owner_user_id_branch_name_idx" ON "stock_movements"("owner_user_id", "branch_name");
