-- Workshop pilot: centre capacity (Toby’s form) and staff recall review.
-- Customer outreach is not enabled by this migration.

CREATE TABLE "workshop_centres" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "technician_count" INTEGER,
    "paid_hours_per_week" DOUBLE PRECISION,
    "hours_next_four_weeks" JSONB NOT NULL DEFAULT '[]',
    "bay_count" INTEGER,
    "labour_rate" DOUBLE PRECISION,
    "manager_name" TEXT,
    "outreach_approver" TEXT,
    "form_received_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_centres_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workshop_centres_owner_user_id_code_key" ON "workshop_centres"("owner_user_id", "code");
CREATE INDEX "workshop_centres_owner_user_id_idx" ON "workshop_centres"("owner_user_id");

CREATE TABLE "workshop_recall_cases" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "centre_code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_recall_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workshop_recall_cases_equipment_id_key" ON "workshop_recall_cases"("equipment_id");
CREATE INDEX "workshop_recall_cases_owner_user_id_idx" ON "workshop_recall_cases"("owner_user_id");
CREATE INDEX "workshop_recall_cases_centre_code_idx" ON "workshop_recall_cases"("centre_code");
CREATE INDEX "workshop_recall_cases_status_idx" ON "workshop_recall_cases"("status");

ALTER TABLE "workshop_recall_cases"
  ADD CONSTRAINT "workshop_recall_cases_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "workshop_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
