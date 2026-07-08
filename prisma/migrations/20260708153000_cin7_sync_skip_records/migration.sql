-- CreateTable
CREATE TABLE "cin7_sync_skip_records" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "sync_run_id" UUID,
    "entity_type" TEXT NOT NULL,
    "cin7_id" TEXT NOT NULL,
    "label" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cin7_sync_skip_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cin7_sync_skip_records_owner_user_id_entity_type_created_at_idx" ON "cin7_sync_skip_records"("owner_user_id", "entity_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cin7_sync_skip_records_sync_run_id_idx" ON "cin7_sync_skip_records"("sync_run_id");

-- AddForeignKey
ALTER TABLE "cin7_sync_skip_records" ADD CONSTRAINT "cin7_sync_skip_records_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "cin7_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
