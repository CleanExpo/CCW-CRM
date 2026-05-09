-- Best-effort backfill for rows created before per-user scoping on extension tables
UPDATE "sales_invoices" si
SET "owner_user_id" = o."owner_user_id"
FROM "orders" o
WHERE si."cin7_order_mapping_id" = o."id"::text
  AND si."owner_user_id" IS NULL;

UPDATE "sales_fulfilments" sf
SET "owner_user_id" = o."owner_user_id"
FROM "orders" o
WHERE sf."cin7_order_mapping_id" = o."id"::text
  AND sf."owner_user_id" IS NULL;

UPDATE "goods_receipts" gr
SET "owner_user_id" = po."owner_user_id"
FROM "purchase_orders" po
WHERE gr."po_reference" = po."po_number"
  AND gr."owner_user_id" IS NULL;
