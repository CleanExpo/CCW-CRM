-- UNI-2750: workshop service plans and booking parts kits. Additive only.

CREATE TABLE "workshop_service_plans" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "service_template_id" UUID,
    "interval_months" INTEGER,
    "interval_hours" INTEGER,
    "price" DOUBLE PRECISION,
    "includes" TEXT NOT NULL DEFAULT '',
    "start_date" DATE NOT NULL,
    "renewal_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_service_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workshop_service_plans_owner_user_id_idx" ON "workshop_service_plans"("owner_user_id");
CREATE INDEX "workshop_service_plans_equipment_id_idx" ON "workshop_service_plans"("equipment_id");
CREATE INDEX "workshop_service_plans_renewal_date_idx" ON "workshop_service_plans"("renewal_date");
-- One active plan per machine. Partial index, so Prisma cannot express it in schema.prisma.
CREATE UNIQUE INDEX "workshop_service_plans_one_active_per_equipment" ON "workshop_service_plans"("equipment_id") WHERE "status" = 'active';

ALTER TABLE "workshop_service_plans"
  ADD CONSTRAINT "workshop_service_plans_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "workshop_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "workshop_booking_parts" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL,

    CONSTRAINT "workshop_booking_parts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workshop_booking_parts_booking_id_product_id_key" ON "workshop_booking_parts"("booking_id", "product_id");
CREATE INDEX "workshop_booking_parts_booking_id_idx" ON "workshop_booking_parts"("booking_id");

ALTER TABLE "workshop_booking_parts"
  ADD CONSTRAINT "workshop_booking_parts_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "workshop_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workshop_booking_parts"
  ADD CONSTRAINT "workshop_booking_parts_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
