-- SendGrid production: delivery tracking, message id index, workspace config
ALTER TABLE "email_messages"
  ADD COLUMN IF NOT EXISTS "delivery_status" TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "delivery_detail" TEXT,
  ADD COLUMN IF NOT EXISTS "last_event_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "email_messages_sendgrid_message_id_idx"
  ON "email_messages"("sendgrid_message_id");

CREATE TABLE IF NOT EXISTS "workspace_sendgrid_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "api_key" TEXT,
  "from_email" TEXT,
  "from_name" TEXT,
  "template_id_invoice" TEXT,
  "template_id_general" TEXT,
  "inbound_mailbox_email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_sendgrid_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_sendgrid_configs_workspace_id_key"
  ON "workspace_sendgrid_configs"("workspace_id");
