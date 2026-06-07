-- Trade finance LC workflow + repayments + tax rates

ALTER TABLE "trade_finance_advances" ADD COLUMN IF NOT EXISTS "lc_id" UUID;

CREATE TABLE IF NOT EXISTS "trade_finance_letters_of_credit" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "facility_id" UUID,
    "lc_number" TEXT NOT NULL,
    "bank_ref" TEXT,
    "beneficiary_supplier_id" UUID,
    "purchase_order_id" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "lc_type" TEXT NOT NULL DEFAULT 'usance',
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_finance_letters_of_credit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trade_finance_lc_documents" (
    "id" UUID NOT NULL,
    "lc_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "presented_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_finance_lc_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trade_finance_lc_amendments" (
    "id" UUID NOT NULL,
    "lc_id" UUID NOT NULL,
    "amendment_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_finance_lc_amendments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trade_finance_repayments" (
    "id" UUID NOT NULL,
    "advance_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_date" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_finance_repayments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tax_rates" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_finance_letters_of_credit_owner_user_id_lc_number_key"
    ON "trade_finance_letters_of_credit"("owner_user_id", "lc_number");
CREATE INDEX IF NOT EXISTS "trade_finance_letters_of_credit_owner_user_id_idx"
    ON "trade_finance_letters_of_credit"("owner_user_id");
CREATE INDEX IF NOT EXISTS "trade_finance_letters_of_credit_status_idx"
    ON "trade_finance_letters_of_credit"("status");
CREATE INDEX IF NOT EXISTS "trade_finance_letters_of_credit_expiry_date_idx"
    ON "trade_finance_letters_of_credit"("expiry_date");

CREATE INDEX IF NOT EXISTS "trade_finance_lc_documents_lc_id_idx" ON "trade_finance_lc_documents"("lc_id");
CREATE INDEX IF NOT EXISTS "trade_finance_lc_amendments_lc_id_idx" ON "trade_finance_lc_amendments"("lc_id");
CREATE INDEX IF NOT EXISTS "trade_finance_repayments_advance_id_idx" ON "trade_finance_repayments"("advance_id");
CREATE INDEX IF NOT EXISTS "trade_finance_advances_lc_id_idx" ON "trade_finance_advances"("lc_id");
CREATE INDEX IF NOT EXISTS "tax_rates_owner_user_id_idx" ON "tax_rates"("owner_user_id");

ALTER TABLE "trade_finance_advances"
    ADD CONSTRAINT "trade_finance_advances_lc_id_fkey"
    FOREIGN KEY ("lc_id") REFERENCES "trade_finance_letters_of_credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trade_finance_letters_of_credit"
    ADD CONSTRAINT "trade_finance_letters_of_credit_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "trade_finance_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trade_finance_letters_of_credit"
    ADD CONSTRAINT "trade_finance_letters_of_credit_beneficiary_supplier_id_fkey"
    FOREIGN KEY ("beneficiary_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trade_finance_letters_of_credit"
    ADD CONSTRAINT "trade_finance_letters_of_credit_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trade_finance_lc_documents"
    ADD CONSTRAINT "trade_finance_lc_documents_lc_id_fkey"
    FOREIGN KEY ("lc_id") REFERENCES "trade_finance_letters_of_credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_finance_lc_amendments"
    ADD CONSTRAINT "trade_finance_lc_amendments_lc_id_fkey"
    FOREIGN KEY ("lc_id") REFERENCES "trade_finance_letters_of_credit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_finance_repayments"
    ADD CONSTRAINT "trade_finance_repayments_advance_id_fkey"
    FOREIGN KEY ("advance_id") REFERENCES "trade_finance_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
