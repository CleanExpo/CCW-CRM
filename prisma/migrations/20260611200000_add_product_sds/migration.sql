-- Migration: add_product_sds
-- AU WHS Regulation 341 / GHS compliance — one SDS record per product

CREATE TABLE "product_sds" (
    "id"                         UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id"                 UUID NOT NULL,
    "sds_pdf_url"                TEXT,
    "ghs_signal_word"            TEXT,
    "hazard_statements"          JSONB NOT NULL DEFAULT '[]',
    "revision_date"              DATE,
    "review_due_date"            DATE,
    "supplier_emergency_contact" TEXT,
    "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "product_sds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_sds_product_id_key" UNIQUE ("product_id"),
    CONSTRAINT "product_sds_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE INDEX "product_sds_product_id_idx" ON "product_sds"("product_id");
CREATE INDEX "product_sds_review_due_date_idx" ON "product_sds"("review_due_date");
