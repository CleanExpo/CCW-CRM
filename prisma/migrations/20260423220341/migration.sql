-- AlterTable
ALTER TABLE IF EXISTS "bank_accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "bank_feed_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "contact_submissions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "demo_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "goods_receipt_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "goods_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "pos_transaction_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "pos_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "purchase_order_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "purchase_orders" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "quote_line_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "sales_fulfilments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "sales_invoices" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "sales_payments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "submission_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE IF EXISTS "suppliers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;
