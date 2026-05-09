import { NextRequest } from 'next/server';
import { jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import { getShadowSessionForUser, isSessionActive } from '@/lib/shadow/memory-session-store';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const session = getShadowSessionForUser(auth.userId);
  if (!session || !isSessionActive(session)) {
    return jsonOk({
      score: 0,
      breakdown: {
        data_completeness: 0,
        sync_accuracy: 0,
        workflow_match: 0,
        ai_confidence: 0,
        integration_health: 0,
      },
      recommendation: 'Start or resume an active shadow session to generate readiness signals.',
      ready_for_transition: false,
    });
  }

  const base = Math.min(
    95,
    35 + session.successful_syncs * 2 + Math.min(20, session.products_observed / 10)
  );

  return jsonOk({
    score: Math.round(base),
    breakdown: {
      data_completeness: Math.round(Math.min(100, 40 + session.customers_observed)),
      sync_accuracy: Math.round(
        session.total_syncs_run > 0
          ? (session.successful_syncs / session.total_syncs_run) * 100
          : 35
      ),
      workflow_match: 42,
      ai_confidence: 38,
      integration_health: 45,
    },
    recommendation:
      'Shadow observation is running. Connect integrations and allow scheduled syncs to improve scores.',
    ready_for_transition: base >= 88,
  });
}
