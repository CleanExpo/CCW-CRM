-- Scope team / org membership: users with the same workspace_id belong to one workspace.

ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "workspace_id" UUID;

UPDATE "app_users" SET "workspace_id" = "id" WHERE "workspace_id" IS NULL;

ALTER TABLE "app_users" ALTER COLUMN "workspace_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "app_users_workspace_id_idx" ON "app_users" ("workspace_id");
