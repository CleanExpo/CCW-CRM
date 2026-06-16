import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCcwPhoneAgentPilotStatus } from '@/lib/phone-agent/ccw-phone-agent-status';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const phoneAgentStatus = getCcwPhoneAgentPilotStatus();

  return NextResponse.json({
    feature_slug: 'ccw_nsw_feasibility_ai_phone_agent',
    feature_name: 'NSW Feasibility + AI Phone Sales Agent',
    codex_access_mode: 'read:write',
    implementation_status: 'foundation_started',
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
