-- Migration: 20260331_010_au_privacy_compliance.sql
-- AU Privacy Act 2024 Compliance Tables
-- UNI-1726 [C7] — AU Privacy Act Compliance Module
-- Deadline: July 2026 | Penalty: $66K/violation

-- ============================================================
-- Consent Records
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose          TEXT NOT NULL,
  consent_given    BOOLEAN NOT NULL,
  consent_version  TEXT NOT NULL DEFAULT '1.0',
  ip_address       INET,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ,
  revocation_reason TEXT
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_own ON consent_records
  FOR ALL
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY consent_service_role ON consent_records
  FOR ALL
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_purpose ON consent_records(purpose);
CREATE INDEX IF NOT EXISTS idx_consent_records_created_at ON consent_records(created_at DESC);

-- ============================================================
-- AI Decision Transparency Log
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_decision_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          TEXT NOT NULL,
  decision_type       TEXT NOT NULL,
  decision_made       TEXT NOT NULL,
  confidence_score    NUMERIC(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  reasoning           TEXT,
  affected_user_ids   UUID[],
  model_used          TEXT,
  input_token_count   INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_decision_log ENABLE ROW LEVEL SECURITY;

-- Service role can read all; users can see decisions that affected them
CREATE POLICY ai_decision_service_role ON ai_decision_log
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY ai_decision_affected_user ON ai_decision_log
  FOR SELECT
  USING (
    (SELECT auth.uid()) = ANY(affected_user_ids)
  );

CREATE INDEX IF NOT EXISTS idx_ai_decision_session ON ai_decision_log(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_type ON ai_decision_log(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decision_created ON ai_decision_log(created_at DESC);

-- ============================================================
-- Data Deletion Requests
-- ============================================================
CREATE TABLE IF NOT EXISTS deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  processed_by    TEXT,
  rejection_reason TEXT
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY deletion_own ON deletion_requests
  FOR ALL
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY deletion_service_role ON deletion_requests
  FOR ALL
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_deletion_user ON deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_status ON deletion_requests(status);

-- ============================================================
-- Data Retention Schedule
-- ============================================================
CREATE TABLE IF NOT EXISTS retention_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL UNIQUE,
  retention_days  INTEGER NOT NULL CHECK (retention_days > 0),
  last_purge_at   TIMESTAMPTZ,
  next_purge_at   TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE retention_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY retention_service_role ON retention_schedule
  FOR ALL
  TO service_role
  USING (true);

-- Seed default retention schedule
INSERT INTO retention_schedule (table_name, retention_days, next_purge_at) VALUES
  ('consent_records',  2555, now() + INTERVAL '90 days'),  -- 7 years
  ('ai_decision_log',  730,  now() + INTERVAL '30 days'),  -- 2 years
  ('deletion_requests',2555, now() + INTERVAL '90 days'),  -- 7 years
  ('audit_evidence',   2555, now() + INTERVAL '90 days')   -- 7 years
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================
-- Migration History Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS _migration_history (
  id           SERIAL PRIMARY KEY,
  migration_id TEXT NOT NULL UNIQUE,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum     TEXT,
  applied_by   TEXT DEFAULT current_user
);

INSERT INTO _migration_history (migration_id) VALUES ('20260331_010_au_privacy_compliance')
ON CONFLICT (migration_id) DO NOTHING;
