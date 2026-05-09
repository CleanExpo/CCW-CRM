-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "pos_transactions" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "sales_fulfilments" ADD COLUMN     "owner_user_id" UUID;

-- AlterTable
ALTER TABLE "sales_invoices" ADD COLUMN     "owner_user_id" UUID;

-- CreateIndex
CREATE INDEX "bank_accounts_owner_user_id_idx" ON "bank_accounts"("owner_user_id");

-- CreateIndex
CREATE INDEX "goods_receipts_owner_user_id_idx" ON "goods_receipts"("owner_user_id");

-- CreateIndex
CREATE INDEX "pos_transactions_owner_user_id_idx" ON "pos_transactions"("owner_user_id");

-- CreateIndex
CREATE INDEX "sales_fulfilments_owner_user_id_idx" ON "sales_fulfilments"("owner_user_id");

-- CreateIndex
CREATE INDEX "sales_invoices_owner_user_id_idx" ON "sales_invoices"("owner_user_id");
