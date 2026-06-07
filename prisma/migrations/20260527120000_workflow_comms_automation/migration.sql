-- UNI-174 workflow automation, notifications, approvals, SLA, operational comms events

CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "trigger_event" TEXT NOT NULL,
  "trigger_conditions" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workflow_templates_owner_user_id_idx" ON "workflow_templates"("owner_user_id");
CREATE INDEX IF NOT EXISTS "workflow_templates_trigger_event_idx" ON "workflow_templates"("trigger_event");
CREATE INDEX IF NOT EXISTS "workflow_templates_is_active_idx" ON "workflow_templates"("is_active");

CREATE TABLE IF NOT EXISTS "workflow_template_actions" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "action_type" TEXT NOT NULL,
  "action_config" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_template_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workflow_template_actions_template_id_idx" ON "workflow_template_actions"("template_id");
DO $$ BEGIN
  ALTER TABLE "workflow_template_actions" ADD CONSTRAINT "workflow_template_actions_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "workflow_instances" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "template_id" UUID,
  "trigger_entity_type" TEXT NOT NULL,
  "trigger_entity_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'running',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "error_message" TEXT,
  CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workflow_instances_owner_user_id_idx" ON "workflow_instances"("owner_user_id");
DO $$ BEGIN
  ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sla_rules" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "sla_hours" INTEGER NOT NULL,
  "escalation_action" TEXT NOT NULL,
  "escalation_config" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sla_rules_owner_user_id_idx" ON "sla_rules"("owner_user_id");

CREATE TABLE IF NOT EXISTS "sla_instances" (
  "id" UUID NOT NULL,
  "sla_rule_id" UUID NOT NULL,
  "entity_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "breached" BOOLEAN NOT NULL DEFAULT false,
  "breach_notified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sla_instances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sla_instances_entity_id_idx" ON "sla_instances"("entity_id");
DO $$ BEGIN
  ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_sla_rule_id_fkey"
    FOREIGN KEY ("sla_rule_id") REFERENCES "sla_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "notification_type" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" UUID,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "in_app_notifications_user_id_idx" ON "in_app_notifications"("user_id");
CREATE INDEX IF NOT EXISTS "in_app_notifications_is_read_idx" ON "in_app_notifications"("is_read");

CREATE TABLE IF NOT EXISTS "approvals" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "approval_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "entity_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "total_steps" INTEGER NOT NULL,
  "current_step" INTEGER NOT NULL DEFAULT 1,
  "requested_by" UUID NOT NULL,
  "notes" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "approvals_owner_user_id_idx" ON "approvals"("owner_user_id");
CREATE INDEX IF NOT EXISTS "approvals_status_idx" ON "approvals"("status");

CREATE TABLE IF NOT EXISTS "approval_steps" (
  "id" UUID NOT NULL,
  "approval_id" UUID NOT NULL,
  "step_number" INTEGER NOT NULL,
  "approver_id" UUID NOT NULL,
  "approver_role" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "comments" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "approval_steps_approval_id_idx" ON "approval_steps"("approval_id");
DO $$ BEGIN
  ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_fkey"
    FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "operational_events" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "customer_id" UUID,
  "event_type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'system',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "entity_type" TEXT,
  "entity_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "operational_events_owner_user_id_idx" ON "operational_events"("owner_user_id");
CREATE INDEX IF NOT EXISTS "operational_events_customer_id_idx" ON "operational_events"("customer_id");
CREATE INDEX IF NOT EXISTS "operational_events_occurred_at_idx" ON "operational_events"("occurred_at");
DO $$ BEGIN
  ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
