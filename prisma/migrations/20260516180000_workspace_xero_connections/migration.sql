CREATE TABLE IF NOT EXISTS "workspace_xero_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "tenant_name" TEXT,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT,
  "token_expires_at" TIMESTAMP(3),
  "connected_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_xero_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_xero_connections_workspace_id_key"
  ON "workspace_xero_connections"("workspace_id");
