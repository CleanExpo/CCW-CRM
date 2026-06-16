-- PostgreSQL-style starter migration for CCW CRM/ERP add-on.
-- Adapt datatypes and naming conventions to the actual CCW-CRM-ERP stack.

CREATE TABLE IF NOT EXISTS ccw_addon_feature_registry (
  id UUID PRIMARY KEY,
  feature_slug VARCHAR(120) UNIQUE NOT NULL,
  version VARCHAR(32) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  config_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_feasibility_statements (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  strategic_objective TEXT NOT NULL,
  owner_question TEXT,
  status VARCHAR(32) DEFAULT 'draft',
  prepared_for VARCHAR(120),
  prepared_by VARCHAR(120),
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_feasibility_scenarios (
  id UUID PRIMARY KEY,
  statement_id UUID REFERENCES ccw_feasibility_statements(id),
  scenario_code VARCHAR(120) NOT NULL,
  scenario_name VARCHAR(255) NOT NULL,
  annual_rent_aud NUMERIC(12,2),
  annual_staff_cost_aud NUMERIC(12,2),
  annual_outgoings_aud NUMERIC(12,2),
  one_off_fitout_aud NUMERIC(12,2),
  one_off_relocation_aud NUMERIC(12,2),
  expected_incremental_margin_aud NUMERIC(12,2),
  risk_score INTEGER,
  strategic_score INTEGER,
  cost_score INTEGER,
  recommendation VARCHAR(80),
  assumptions_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_market_map_points (
  id UUID PRIMARY KEY,
  point_code VARCHAR(120) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  point_type VARCHAR(80) NOT NULL,
  suburb VARCHAR(120),
  state VARCHAR(16),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  heat_score INTEGER,
  confidence VARCHAR(80),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_parcel_collection_locations (
  id UUID PRIMARY KEY,
  location_code VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  state VARCHAR(16),
  priority INTEGER,
  model VARCHAR(120),
  status VARCHAR(32) DEFAULT 'candidate',
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  rules_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_phone_agents (
  id UUID PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  elevenlabs_agent_id VARCHAR(120),
  twilio_phone_number VARCHAR(32),
  mode VARCHAR(32) DEFAULT 'after_hours_pilot',
  recording_enabled BOOLEAN DEFAULT FALSE,
  human_handoff_team VARCHAR(80),
  active BOOLEAN DEFAULT FALSE,
  config_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_knowledge_sources (
  id UUID PRIMARY KEY,
  source_code VARCHAR(120) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_url TEXT,
  file_path TEXT,
  approval_status VARCHAR(32) DEFAULT 'draft',
  approved_by VARCHAR(120),
  last_synced_at TIMESTAMP,
  version_hash VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_call_sessions (
  id UUID PRIMARY KEY,
  twilio_call_sid VARCHAR(120) UNIQUE,
  elevenlabs_conversation_id VARCHAR(120),
  direction VARCHAR(16),
  caller_phone VARCHAR(32),
  called_number VARCHAR(32),
  customer_id UUID NULL,
  lead_id UUID NULL,
  opportunity_id UUID NULL,
  service_request_id UUID NULL,
  status VARCHAR(32),
  outcome VARCHAR(80),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  summary TEXT,
  compliance_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_call_events (
  id UUID PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  external_event_id VARCHAR(160),
  twilio_call_sid VARCHAR(120),
  payload_json JSONB,
  processed_at TIMESTAMP,
  processing_status VARCHAR(32),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_call_transcripts (
  id UUID PRIMARY KEY,
  call_session_id UUID REFERENCES ccw_ai_call_sessions(id),
  transcript_text TEXT,
  redacted_transcript_text TEXT,
  evidence_refs_json JSONB,
  retention_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ccw_ai_consents (
  id UUID PRIMARY KEY,
  call_session_id UUID REFERENCES ccw_ai_call_sessions(id),
  customer_id UUID NULL,
  phone_number VARCHAR(32),
  consent_type VARCHAR(80),
  consent_status VARCHAR(32),
  consent_source VARCHAR(80),
  evidence_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ccw_ai_call_sessions_twilio_sid ON ccw_ai_call_sessions(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_ccw_market_map_points_type ON ccw_market_map_points(point_type);
CREATE INDEX IF NOT EXISTS idx_ccw_parcel_locations_status ON ccw_parcel_collection_locations(status);
