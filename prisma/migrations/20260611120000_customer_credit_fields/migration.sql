-- Migration: customer credit fields
-- Adds creditLimitAUD, creditTermsDays, creditTermsType to customers table.
-- All nullable so existing rows are unaffected and no backfill is needed.
-- creditTermsType is constrained to 'NET' | 'EOM' via CHECK to prevent bad writes.

ALTER TABLE "customers"
  ADD COLUMN "credit_limit_aud"  DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN "credit_terms_days" INTEGER       DEFAULT NULL,
  ADD COLUMN "credit_terms_type" TEXT          DEFAULT NULL;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_credit_terms_type_check"
    CHECK ("credit_terms_type" IS NULL OR "credit_terms_type" IN ('NET', 'EOM'));

-- Index: speed up credit-gate query (find by customer + ownerUserId is already covered by pk/workspace index)
-- No additional index needed — credit gate queries by primary key after workspace guard.
