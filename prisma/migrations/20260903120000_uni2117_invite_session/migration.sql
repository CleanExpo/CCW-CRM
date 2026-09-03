-- UNI-2117: hashed invite tokens + session version for JWT invalidation

ALTER TABLE "app_users"
  ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "invite_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "invite_token_expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
