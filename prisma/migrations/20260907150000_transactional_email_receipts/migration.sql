-- UNI-2671 A3: receipts + outbound queue for transactional email.
--
-- Additive only. No existing table is altered, so a rollback is a DROP of this
-- one table and nothing else in the application changes shape.

CREATE TABLE IF NOT EXISTS "transactional_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template" TEXT NOT NULL,
    "recipient_hash" TEXT NOT NULL,
    "recipient_email" TEXT,
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "sandboxed" BOOLEAN NOT NULL DEFAULT false,
    "delivery_status" TEXT,
    "delivery_detail" TEXT,
    "last_event_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "transactional_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transactional_emails_status_next_attempt_at_idx"
    ON "transactional_emails"("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "transactional_emails_provider_message_id_idx"
    ON "transactional_emails"("provider_message_id");
CREATE INDEX IF NOT EXISTS "transactional_emails_recipient_hash_idx"
    ON "transactional_emails"("recipient_hash");
CREATE INDEX IF NOT EXISTS "transactional_emails_template_idx"
    ON "transactional_emails"("template");
