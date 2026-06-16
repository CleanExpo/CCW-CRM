-- UNI-2140 CCW feasibility ally, evidence standard, AI phone agent, and follow-up production schema

CREATE TABLE IF NOT EXISTS "ccw_addon_feature_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "feature_slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'disabled',
  "config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_addon_feature_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ccw_addon_feature_configs_owner_user_id_feature_slug_key"
  ON "ccw_addon_feature_configs"("owner_user_id", "feature_slug");
CREATE INDEX IF NOT EXISTS "ccw_addon_feature_configs_owner_user_id_idx" ON "ccw_addon_feature_configs"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_addon_feature_configs_status_idx" ON "ccw_addon_feature_configs"("status");

CREATE TABLE IF NOT EXISTS "ccw_feasibility_statements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "parent_statement_id" UUID,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "content_markdown" TEXT,
  "evidence_summary" JSONB NOT NULL DEFAULT '{}',
  "generated_by" TEXT NOT NULL DEFAULT 'codex',
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_feasibility_statements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_feasibility_statements_owner_user_id_idx" ON "ccw_feasibility_statements"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_statements_parent_statement_id_idx" ON "ccw_feasibility_statements"("parent_statement_id");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_statements_status_idx" ON "ccw_feasibility_statements"("status");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_statements_created_at_idx" ON "ccw_feasibility_statements"("created_at");
DO $$ BEGIN
  ALTER TABLE "ccw_feasibility_statements" ADD CONSTRAINT "ccw_feasibility_statements_parent_statement_id_fkey"
    FOREIGN KEY ("parent_statement_id") REFERENCES "ccw_feasibility_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_feasibility_scenarios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "statement_id" UUID NOT NULL,
  "parent_scenario_id" UUID,
  "scenario_code" TEXT NOT NULL,
  "scenario_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "annual_rent_aud" DOUBLE PRECISION,
  "annual_staff_cost_aud" DOUBLE PRECISION,
  "annual_outgoings_aud" DOUBLE PRECISION,
  "one_off_fitout_aud" DOUBLE PRECISION,
  "one_off_relocation_aud" DOUBLE PRECISION,
  "expected_incremental_margin_aud" DOUBLE PRECISION,
  "baseline_annual_cost_aud" DOUBLE PRECISION,
  "required_extra_monthly_contribution_aud" DOUBLE PRECISION,
  "weighted_feasibility_score" DOUBLE PRECISION,
  "recommendation" TEXT,
  "score_breakdown" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_feasibility_scenarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ccw_feasibility_scenarios_statement_id_scenario_code_key"
  ON "ccw_feasibility_scenarios"("statement_id", "scenario_code");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_scenarios_owner_user_id_idx" ON "ccw_feasibility_scenarios"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_scenarios_statement_id_idx" ON "ccw_feasibility_scenarios"("statement_id");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_scenarios_parent_scenario_id_idx" ON "ccw_feasibility_scenarios"("parent_scenario_id");
CREATE INDEX IF NOT EXISTS "ccw_feasibility_scenarios_recommendation_idx" ON "ccw_feasibility_scenarios"("recommendation");
DO $$ BEGIN
  ALTER TABLE "ccw_feasibility_scenarios" ADD CONSTRAINT "ccw_feasibility_scenarios_statement_id_fkey"
    FOREIGN KEY ("statement_id") REFERENCES "ccw_feasibility_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ccw_feasibility_scenarios" ADD CONSTRAINT "ccw_feasibility_scenarios_parent_scenario_id_fkey"
    FOREIGN KEY ("parent_scenario_id") REFERENCES "ccw_feasibility_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_financial_claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "statement_id" UUID,
  "scenario_id" UUID,
  "claim_type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value_aud" DOUBLE PRECISION,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "state" TEXT NOT NULL DEFAULT 'owner_entered',
  "source_system" TEXT NOT NULL DEFAULT 'manual',
  "xero_account_code" TEXT,
  "xero_tenant_id" TEXT,
  "confidence_score" DOUBLE PRECISION,
  "notes" TEXT,
  "adjusted_by" UUID,
  "adjusted_at" TIMESTAMP(3),
  "backed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_financial_claims_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_financial_claims_owner_user_id_idx" ON "ccw_financial_claims"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_financial_claims_statement_id_idx" ON "ccw_financial_claims"("statement_id");
CREATE INDEX IF NOT EXISTS "ccw_financial_claims_scenario_id_idx" ON "ccw_financial_claims"("scenario_id");
CREATE INDEX IF NOT EXISTS "ccw_financial_claims_claim_type_idx" ON "ccw_financial_claims"("claim_type");
CREATE INDEX IF NOT EXISTS "ccw_financial_claims_state_idx" ON "ccw_financial_claims"("state");
DO $$ BEGIN
  ALTER TABLE "ccw_financial_claims" ADD CONSTRAINT "ccw_financial_claims_statement_id_fkey"
    FOREIGN KEY ("statement_id") REFERENCES "ccw_feasibility_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ccw_financial_claims" ADD CONSTRAINT "ccw_financial_claims_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "ccw_feasibility_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_financial_claim_evidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "claim_id" UUID NOT NULL,
  "evidence_type" TEXT NOT NULL,
  "source_system" TEXT NOT NULL DEFAULT 'xero',
  "source_reference" TEXT,
  "source_url" TEXT,
  "amount_aud" DOUBLE PRECISION,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_financial_claim_evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_financial_claim_evidence_claim_id_idx" ON "ccw_financial_claim_evidence"("claim_id");
CREATE INDEX IF NOT EXISTS "ccw_financial_claim_evidence_source_system_idx" ON "ccw_financial_claim_evidence"("source_system");
CREATE INDEX IF NOT EXISTS "ccw_financial_claim_evidence_captured_at_idx" ON "ccw_financial_claim_evidence"("captured_at");
DO $$ BEGIN
  ALTER TABLE "ccw_financial_claim_evidence" ADD CONSTRAINT "ccw_financial_claim_evidence_claim_id_fkey"
    FOREIGN KEY ("claim_id") REFERENCES "ccw_financial_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_evidence_findings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "statement_id" UUID,
  "scenario_id" UUID,
  "finding_type" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "claim" TEXT NOT NULL,
  "source_label" TEXT,
  "source_url" TEXT,
  "source_path" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "review_required" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_evidence_findings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_evidence_findings_owner_user_id_idx" ON "ccw_evidence_findings"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_evidence_findings_statement_id_idx" ON "ccw_evidence_findings"("statement_id");
CREATE INDEX IF NOT EXISTS "ccw_evidence_findings_scenario_id_idx" ON "ccw_evidence_findings"("scenario_id");
CREATE INDEX IF NOT EXISTS "ccw_evidence_findings_tag_idx" ON "ccw_evidence_findings"("tag");
CREATE INDEX IF NOT EXISTS "ccw_evidence_findings_status_idx" ON "ccw_evidence_findings"("status");
DO $$ BEGIN
  ALTER TABLE "ccw_evidence_findings" ADD CONSTRAINT "ccw_evidence_findings_statement_id_fkey"
    FOREIGN KEY ("statement_id") REFERENCES "ccw_feasibility_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ccw_evidence_findings" ADD CONSTRAINT "ccw_evidence_findings_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "ccw_feasibility_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_growth_opportunities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "statement_id" UUID,
  "title" TEXT NOT NULL,
  "opportunity_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'candidate',
  "description" TEXT,
  "expected_benefit" JSONB NOT NULL DEFAULT '{}',
  "decision_gate" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_growth_opportunities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_growth_opportunities_owner_user_id_idx" ON "ccw_growth_opportunities"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_growth_opportunities_statement_id_idx" ON "ccw_growth_opportunities"("statement_id");
CREATE INDEX IF NOT EXISTS "ccw_growth_opportunities_opportunity_type_idx" ON "ccw_growth_opportunities"("opportunity_type");
CREATE INDEX IF NOT EXISTS "ccw_growth_opportunities_status_idx" ON "ccw_growth_opportunities"("status");
DO $$ BEGIN
  ALTER TABLE "ccw_growth_opportunities" ADD CONSTRAINT "ccw_growth_opportunities_statement_id_fkey"
    FOREIGN KEY ("statement_id") REFERENCES "ccw_feasibility_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_opportunity_measurements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "opportunity_id" UUID NOT NULL,
  "scenario_id" UUID,
  "metric_name" TEXT NOT NULL,
  "metric_value" DOUBLE PRECISION,
  "unit" TEXT,
  "source_system" TEXT NOT NULL DEFAULT 'manual',
  "source_payload" JSONB NOT NULL DEFAULT '{}',
  "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_opportunity_measurements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_opportunity_measurements_opportunity_id_idx" ON "ccw_opportunity_measurements"("opportunity_id");
CREATE INDEX IF NOT EXISTS "ccw_opportunity_measurements_scenario_id_idx" ON "ccw_opportunity_measurements"("scenario_id");
CREATE INDEX IF NOT EXISTS "ccw_opportunity_measurements_metric_name_idx" ON "ccw_opportunity_measurements"("metric_name");
DO $$ BEGIN
  ALTER TABLE "ccw_opportunity_measurements" ADD CONSTRAINT "ccw_opportunity_measurements_opportunity_id_fkey"
    FOREIGN KEY ("opportunity_id") REFERENCES "ccw_growth_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ccw_opportunity_measurements" ADD CONSTRAINT "ccw_opportunity_measurements_scenario_id_fkey"
    FOREIGN KEY ("scenario_id") REFERENCES "ccw_feasibility_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_ai_knowledge_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "source_type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT,
  "trust_level" TEXT NOT NULL DEFAULT 'trusted',
  "refresh_cadence" TEXT,
  "last_indexed_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_ai_knowledge_sources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_ai_knowledge_sources_owner_user_id_idx" ON "ccw_ai_knowledge_sources"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_knowledge_sources_source_type_idx" ON "ccw_ai_knowledge_sources"("source_type");
CREATE INDEX IF NOT EXISTS "ccw_ai_knowledge_sources_status_idx" ON "ccw_ai_knowledge_sources"("status");

CREATE TABLE IF NOT EXISTS "ccw_ai_call_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "customer_id" UUID,
  "contact_id" UUID,
  "twilio_call_sid" TEXT,
  "elevenlabs_call_id" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'inbound',
  "channel" TEXT NOT NULL DEFAULT 'phone',
  "caller_number_hash" TEXT,
  "transcript" TEXT,
  "summary" TEXT,
  "intent" TEXT,
  "outcome" TEXT,
  "handoff_required" BOOLEAN NOT NULL DEFAULT false,
  "consent_captured" BOOLEAN NOT NULL DEFAULT false,
  "recording_url" TEXT,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_ai_call_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ccw_ai_call_sessions_twilio_call_sid_key" ON "ccw_ai_call_sessions"("twilio_call_sid");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_owner_user_id_idx" ON "ccw_ai_call_sessions"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_customer_id_idx" ON "ccw_ai_call_sessions"("customer_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_contact_id_idx" ON "ccw_ai_call_sessions"("contact_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_intent_idx" ON "ccw_ai_call_sessions"("intent");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_outcome_idx" ON "ccw_ai_call_sessions"("outcome");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_sessions_started_at_idx" ON "ccw_ai_call_sessions"("started_at");

CREATE TABLE IF NOT EXISTS "ccw_ai_call_triage_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "call_session_id" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence_score" DOUBLE PRECISION,
  "human_reviewer_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_ai_call_triage_decisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ccw_ai_call_triage_decisions_call_session_id_key"
  ON "ccw_ai_call_triage_decisions"("call_session_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_call_triage_decisions_decision_idx" ON "ccw_ai_call_triage_decisions"("decision");
DO $$ BEGIN
  ALTER TABLE "ccw_ai_call_triage_decisions" ADD CONSTRAINT "ccw_ai_call_triage_decisions_call_session_id_fkey"
    FOREIGN KEY ("call_session_id") REFERENCES "ccw_ai_call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_ai_conversation_insights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "call_session_id" UUID,
  "insight_type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_ai_conversation_insights_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_ai_conversation_insights_owner_user_id_idx" ON "ccw_ai_conversation_insights"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_conversation_insights_call_session_id_idx" ON "ccw_ai_conversation_insights"("call_session_id");
CREATE INDEX IF NOT EXISTS "ccw_ai_conversation_insights_insight_type_idx" ON "ccw_ai_conversation_insights"("insight_type");
CREATE INDEX IF NOT EXISTS "ccw_ai_conversation_insights_status_idx" ON "ccw_ai_conversation_insights"("status");
DO $$ BEGIN
  ALTER TABLE "ccw_ai_conversation_insights" ADD CONSTRAINT "ccw_ai_conversation_insights_call_session_id_fkey"
    FOREIGN KEY ("call_session_id") REFERENCES "ccw_ai_call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_specialized_agents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "agent_code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "persona" JSONB NOT NULL DEFAULT '{}',
  "playbook" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_specialized_agents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ccw_specialized_agents_owner_user_id_agent_code_key"
  ON "ccw_specialized_agents"("owner_user_id", "agent_code");
CREATE INDEX IF NOT EXISTS "ccw_specialized_agents_owner_user_id_idx" ON "ccw_specialized_agents"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_specialized_agents_status_idx" ON "ccw_specialized_agents"("status");

CREATE TABLE IF NOT EXISTS "ccw_agent_learning" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agent_id" UUID NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" UUID,
  "lesson" TEXT NOT NULL,
  "confidence_score" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'pending_review',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_agent_learning_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_agent_learning_agent_id_idx" ON "ccw_agent_learning"("agent_id");
CREATE INDEX IF NOT EXISTS "ccw_agent_learning_source_type_idx" ON "ccw_agent_learning"("source_type");
CREATE INDEX IF NOT EXISTS "ccw_agent_learning_status_idx" ON "ccw_agent_learning"("status");
DO $$ BEGIN
  ALTER TABLE "ccw_agent_learning" ADD CONSTRAINT "ccw_agent_learning_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "ccw_specialized_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_follow_up_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "agent_id" UUID,
  "rule_type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger_config" JSONB NOT NULL DEFAULT '{}',
  "channel_config" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_follow_up_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_follow_up_rules_owner_user_id_idx" ON "ccw_follow_up_rules"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_rules_agent_id_idx" ON "ccw_follow_up_rules"("agent_id");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_rules_rule_type_idx" ON "ccw_follow_up_rules"("rule_type");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_rules_status_idx" ON "ccw_follow_up_rules"("status");
DO $$ BEGIN
  ALTER TABLE "ccw_follow_up_rules" ADD CONSTRAINT "ccw_follow_up_rules_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "ccw_specialized_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_follow_up_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "rule_id" UUID,
  "call_session_id" UUID,
  "action_type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "recipient_ref" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "scheduled_for" TIMESTAMP(3),
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_follow_up_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_owner_user_id_idx" ON "ccw_follow_up_actions"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_rule_id_idx" ON "ccw_follow_up_actions"("rule_id");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_call_session_id_idx" ON "ccw_follow_up_actions"("call_session_id");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_action_type_idx" ON "ccw_follow_up_actions"("action_type");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_status_idx" ON "ccw_follow_up_actions"("status");
CREATE INDEX IF NOT EXISTS "ccw_follow_up_actions_scheduled_for_idx" ON "ccw_follow_up_actions"("scheduled_for");
DO $$ BEGIN
  ALTER TABLE "ccw_follow_up_actions" ADD CONSTRAINT "ccw_follow_up_actions_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "ccw_follow_up_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ccw_follow_up_actions" ADD CONSTRAINT "ccw_follow_up_actions_call_session_id_fkey"
    FOREIGN KEY ("call_session_id") REFERENCES "ccw_ai_call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ccw_industry_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'concept',
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "venue" TEXT,
  "description" TEXT,
  "agenda" JSONB NOT NULL DEFAULT '{}',
  "speaker_plan" JSONB NOT NULL DEFAULT '{}',
  "marketing_plan" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ccw_industry_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ccw_industry_events_owner_user_id_idx" ON "ccw_industry_events"("owner_user_id");
CREATE INDEX IF NOT EXISTS "ccw_industry_events_event_type_idx" ON "ccw_industry_events"("event_type");
CREATE INDEX IF NOT EXISTS "ccw_industry_events_status_idx" ON "ccw_industry_events"("status");
CREATE INDEX IF NOT EXISTS "ccw_industry_events_starts_at_idx" ON "ccw_industry_events"("starts_at");
