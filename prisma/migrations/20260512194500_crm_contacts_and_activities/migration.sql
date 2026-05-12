-- CRM contacts (people) and activities (interaction log), workspace-scoped.

CREATE TABLE "crm_contacts" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "customer_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "job_title" TEXT,
    "department" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_activities" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "activity_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "customer_id" UUID,
    "contact_id" UUID,
    "order_id" UUID,
    "quote_id" UUID,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_contacts_owner_user_id_idx" ON "crm_contacts"("owner_user_id");
CREATE INDEX "crm_contacts_customer_id_idx" ON "crm_contacts"("customer_id");
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts"("email");

CREATE INDEX "crm_activities_owner_user_id_idx" ON "crm_activities"("owner_user_id");
CREATE INDEX "crm_activities_customer_id_idx" ON "crm_activities"("customer_id");
CREATE INDEX "crm_activities_contact_id_idx" ON "crm_activities"("contact_id");
CREATE INDEX "crm_activities_activity_type_idx" ON "crm_activities"("activity_type");
CREATE INDEX "crm_activities_due_date_idx" ON "crm_activities"("due_date");

ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
