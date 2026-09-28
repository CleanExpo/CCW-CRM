-- Area 2: persist Cin7 Cost / Average Landed Cost (not retail).
-- Area 1: keep fractional SOH for the 29 Sep freeze (Anne 97,307.06).

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cin7_cost" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cin7_average_landed_cost" DOUBLE PRECISION;

ALTER TABLE "cin7_stock_levels"
  ALTER COLUMN "available" TYPE DECIMAL(14, 4) USING "available"::decimal,
  ALTER COLUMN "stock_on_hand" TYPE DECIMAL(14, 4) USING "stock_on_hand"::decimal,
  ALTER COLUMN "incoming" TYPE DECIMAL(14, 4) USING "incoming"::decimal,
  ALTER COLUMN "open_sales" TYPE DECIMAL(14, 4) USING "open_sales"::decimal;
