-- Submission notes (CRM) + local sales fulfilment / invoice / payment records (Cin7-shaped API)

CREATE TABLE "submission_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contact_submission_id" UUID,
    "demo_request_id" UUID,
    "note_type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "submission_notes_contact_submission_id_idx" ON "submission_notes"("contact_submission_id");
CREATE INDEX "submission_notes_demo_request_id_idx" ON "submission_notes"("demo_request_id");

ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_contact_submission_id_fkey" FOREIGN KEY ("contact_submission_id") REFERENCES "contact_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "submission_notes" ADD CONSTRAINT "submission_notes_demo_request_id_fkey" FOREIGN KEY ("demo_request_id") REFERENCES "demo_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sales_fulfilments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cin7_order_mapping_id" TEXT NOT NULL,
    "cin7_fulfilment_id" TEXT,
    "order_reference" TEXT,
    "status" TEXT NOT NULL,
    "pick_location" TEXT,
    "tracking_number" TEXT,
    "carrier" TEXT,
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_fulfilments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_fulfilments_cin7_order_mapping_id_idx" ON "sales_fulfilments"("cin7_order_mapping_id");

CREATE TABLE "sales_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cin7_order_mapping_id" TEXT NOT NULL,
    "cin7_invoice_id" TEXT,
    "invoice_number" TEXT,
    "invoice_date" DATE,
    "due_date" DATE,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "status" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "order_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_invoices_cin7_order_mapping_id_idx" ON "sales_invoices"("cin7_order_mapping_id");

CREATE TABLE "sales_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sales_invoice_id" UUID,
    "cin7_invoice_id" TEXT,
    "cin7_payment_id" TEXT,
    "payment_method" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "payment_date" DATE,
    "reference" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_payments_sales_invoice_id_idx" ON "sales_payments"("sales_invoice_id");

ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
