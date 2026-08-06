-- One persistent sync status row per (owner, entity).
-- Keep the newest run when duplicates exist, then enforce uniqueness.

DELETE FROM "cin7_sync_runs" AS older
USING "cin7_sync_runs" AS newer
WHERE older."owner_user_id" = newer."owner_user_id"
  AND older."entity_type" = newer."entity_type"
  AND (
    older."created_at" < newer."created_at"
    OR (older."created_at" = newer."created_at" AND older."id"::text < newer."id"::text)
  );

ALTER TABLE "cin7_sync_runs"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "cin7_sync_runs"
SET "updated_at" = "created_at"
WHERE "updated_at" IS DISTINCT FROM "created_at";

DROP INDEX IF EXISTS "cin7_sync_runs_owner_user_id_created_at_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "cin7_sync_runs_owner_user_id_entity_type_key"
  ON "cin7_sync_runs"("owner_user_id", "entity_type");

CREATE INDEX IF NOT EXISTS "cin7_sync_runs_owner_user_id_updated_at_idx"
  ON "cin7_sync_runs"("owner_user_id", "updated_at" DESC);
