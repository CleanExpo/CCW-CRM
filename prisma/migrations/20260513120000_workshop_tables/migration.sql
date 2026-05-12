-- Workshop / field-service registry: equipment, job templates, bookings, reminders

CREATE TABLE "workshop_equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "product_id" UUID,
    "serial_number" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "location" TEXT NOT NULL,
    "purchase_date" DATE,
    "warranty_expiry" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "interval_months" INTEGER,
    "interval_hours" INTEGER,
    "current_hours" INTEGER NOT NULL DEFAULT 0,
    "last_service_date" DATE,
    "last_service_hours" INTEGER,
    "next_service_date" DATE,
    "next_service_hours" INTEGER,
    "reminder_lead_days" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_service_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "applies_to_make" TEXT,
    "applies_to_model" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "estimated_hours" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_service_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_service_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "workshop_service_template_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "booking_number" TEXT NOT NULL,
    "equipment_id" UUID NOT NULL,
    "service_request_id" UUID,
    "service_template_id" UUID,
    "contractor_id" UUID,
    "location" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "estimated_end_datetime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "purchase_order_id" UUID,
    "parts_ordered_at" TIMESTAMP(3),
    "actual_hours" DOUBLE PRECISION,
    "hours_on_completion" INTEGER,
    "technician_notes" TEXT,
    "customer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_service_reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "scheduled_send_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "booking_id" UUID,
    "email_subject" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_service_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workshop_equipment_owner_user_id_idx" ON "workshop_equipment"("owner_user_id");
CREATE INDEX "workshop_equipment_customer_id_idx" ON "workshop_equipment"("customer_id");
CREATE INDEX "workshop_equipment_location_idx" ON "workshop_equipment"("location");
CREATE INDEX "workshop_equipment_status_idx" ON "workshop_equipment"("status");

CREATE INDEX "workshop_service_templates_owner_user_id_idx" ON "workshop_service_templates"("owner_user_id");
CREATE INDEX "workshop_service_template_items_template_id_idx" ON "workshop_service_template_items"("template_id");

CREATE UNIQUE INDEX "workshop_bookings_owner_user_id_booking_number_key" ON "workshop_bookings"("owner_user_id", "booking_number");
CREATE INDEX "workshop_bookings_owner_user_id_idx" ON "workshop_bookings"("owner_user_id");
CREATE INDEX "workshop_bookings_equipment_id_idx" ON "workshop_bookings"("equipment_id");
CREATE INDEX "workshop_bookings_scheduled_date_idx" ON "workshop_bookings"("scheduled_date");

CREATE INDEX "workshop_service_reminders_owner_user_id_idx" ON "workshop_service_reminders"("owner_user_id");
CREATE INDEX "workshop_service_reminders_equipment_id_idx" ON "workshop_service_reminders"("equipment_id");
CREATE INDEX "workshop_service_reminders_status_idx" ON "workshop_service_reminders"("status");
CREATE INDEX "workshop_service_reminders_scheduled_send_at_idx" ON "workshop_service_reminders"("scheduled_send_at");

ALTER TABLE "workshop_equipment" ADD CONSTRAINT "workshop_equipment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_equipment" ADD CONSTRAINT "workshop_equipment_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workshop_service_template_items" ADD CONSTRAINT "workshop_service_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workshop_service_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_service_template_items" ADD CONSTRAINT "workshop_service_template_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workshop_bookings" ADD CONSTRAINT "workshop_bookings_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "workshop_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_bookings" ADD CONSTRAINT "workshop_bookings_service_template_id_fkey" FOREIGN KEY ("service_template_id") REFERENCES "workshop_service_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workshop_service_reminders" ADD CONSTRAINT "workshop_service_reminders_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "workshop_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_service_reminders" ADD CONSTRAINT "workshop_service_reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_service_reminders" ADD CONSTRAINT "workshop_service_reminders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "workshop_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
