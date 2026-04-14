-- Rollback: 20260331_010_au_privacy_compliance.sql
-- Drop AU Privacy Act compliance tables

DROP TABLE IF EXISTS retention_schedule CASCADE;
DROP TABLE IF EXISTS deletion_requests CASCADE;
DROP TABLE IF EXISTS ai_decision_log CASCADE;
DROP TABLE IF EXISTS consent_records CASCADE;
DROP TABLE IF EXISTS _migration_history CASCADE;
