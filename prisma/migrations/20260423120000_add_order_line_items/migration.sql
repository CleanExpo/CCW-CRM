-- Order line items for persisted line-level revenue (dashboard + order detail)

CREATE TABLE "order_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "line_total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_line_items_order_id_idx" ON "order_line_items"("order_id");
CREATE INDEX "order_line_items_product_id_idx" ON "order_line_items"("product_id");

ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
