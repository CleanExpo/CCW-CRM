CREATE TABLE "workspace_upcoming_integration_secrets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "google_ai_api_key" TEXT,
    "anthropic_api_key" TEXT,
    "heygen_api_key" TEXT,
    "ap2_client_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_upcoming_integration_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_upcoming_integration_secrets_workspace_id_key" ON "workspace_upcoming_integration_secrets"("workspace_id");
