-- Per-location reorder settings and rules
ALTER TABLE "product_location_stock" ADD COLUMN "reorder_point" INTEGER;
ALTER TABLE "product_location_stock" ADD COLUMN "reorder_quantity" INTEGER;
ALTER TABLE "product_location_stock" ADD COLUMN "lead_time_days" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "product_location_stock" ADD COLUMN "auto_approve_under_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product_location_stock" ADD COLUMN "reorder_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Stock reservations (ties to ProductLocationStock.reserved)
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_reservations_owner_user_id_idx" ON "stock_reservations"("owner_user_id");
CREATE INDEX "stock_reservations_product_id_idx" ON "stock_reservations"("product_id");
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations"("status");

ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stock takes (warehouse tab)
CREATE TABLE "inventory_stock_takes" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_stock_takes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_stock_takes_owner_user_id_idx" ON "inventory_stock_takes"("owner_user_id");

CREATE TABLE "inventory_stock_take_lines" (
    "id" UUID NOT NULL,
    "take_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "counted_qty" INTEGER NOT NULL,

    CONSTRAINT "inventory_stock_take_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_stock_take_lines_take_id_idx" ON "inventory_stock_take_lines"("take_id");
CREATE UNIQUE INDEX "inventory_stock_take_lines_take_id_product_id_key" ON "inventory_stock_take_lines"("take_id", "product_id");

ALTER TABLE "inventory_stock_take_lines" ADD CONSTRAINT "inventory_stock_take_lines_take_id_fkey" FOREIGN KEY ("take_id") REFERENCES "inventory_stock_takes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_take_lines" ADD CONSTRAINT "inventory_stock_take_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
