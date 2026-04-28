DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamRole') THEN
    CREATE TYPE "TeamRole" AS ENUM ('owner', 'admin', 'member', 'billing');
  END IF;
END $$;

ALTER TABLE "app_users"
  ADD COLUMN IF NOT EXISTS "role" "TeamRole" NOT NULL DEFAULT 'member';

UPDATE "app_users"
SET "role" = 'owner'
WHERE "is_admin" = true AND "role" = 'member';
