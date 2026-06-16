import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  getConfiguredTokenSource,
  getXeroMode,
  hasLiveClientCredentials,
} from '@/lib/integrations/xero';
import { getCcwPhoneAgentPilotStatus } from '@/lib/phone-agent/ccw-phone-agent-status';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const phoneAgentStatus = getCcwPhoneAgentPilotStatus();
  const xeroTokenSource = getConfiguredTokenSource(request);

  return NextResponse.json({
    feature_slug: 'ccw_nsw_feasibility_ai_phone_agent',
    feature_name: 'NSW Feasibility + AI Phone Sales Agent',
    codex_access_mode: 'read:write',
    implementation_status: 'production_schema_started',
    xero_backing: {
      mode: getXeroMode(),
      live_client_credentials_configured: hasLiveClientCredentials(),
      token_source_configured: Boolean(xeroTokenSource),
      backing_policy:
        'Toby-adjusted claims are retained until an explicit owner-approved Xero overwrite is requested.',
    },
    production_modules: {
      feasibility_statement_lineage: 'schema_ready',
      scenario_measurement: 'schema_and_scoring_ready',
      evidence_findings: 'schema_and_parser_ready',
      xero_backed_financial_claims: 'schema_and_merge_rules_ready',
      ai_phone_gatekeeper: phoneAgentStatus.ready_for_inbound_pilot
        ? 'inbound_pilot_ready'
        : 'configuration_required',
      conversation_learning: 'schema_ready',
      follow_up_agents: 'schema_ready',
      industry_events: 'schema_ready',
    },
    strategic_objective: {
      owner_question: 'What are we trying to achieve?',
      answer:
        'Increase profitable customer access and sales conversion while protecting the Seven Hills cost advantage.',
    },
    recommended_default_posture: {
      site_strategy: 'Keep Seven Hills as the NSW operational baseline until data proves a better option.',
      pilot_strategy: 'Start with parcel collection and after-hours / overflow AI phone capture before higher rent or extra stock.',
      ai_phone_agent: 'after_hours_overflow_pilot',
    },
    phone_agent: phoneAgentStatus,
  });
}
