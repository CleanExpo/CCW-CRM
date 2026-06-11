-- Migration: add_workspace_settings
-- Context: Replaces the in-memory company-store (PR #202 / UNI-2111) with a
-- persistent DB table so company settings survive server restarts.

CREATE TABLE IF NOT EXISTS "workspace_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'My Company',
  "slug" TEXT NOT NULL DEFAULT 'my-company',
  "trading_name" TEXT,
  "abn" TEXT,
  "acn" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_settings_workspace_id_key"
  ON "workspace_settings"("workspace_id");
