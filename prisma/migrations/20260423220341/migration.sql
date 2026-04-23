-- AlterTable
ALTER TABLE "bank_accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_feed_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contact_submissions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "demo_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "goods_receipt_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "goods_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_transaction_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pos_transactions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_order_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quote_line_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_fulfilments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_invoices" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_payments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "submission_notes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;
