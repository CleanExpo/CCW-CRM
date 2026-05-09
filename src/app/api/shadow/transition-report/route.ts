import { NextRequest } from 'next/server';
import { jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import { getShadowSessionForUser, isSessionActive } from '@/lib/shadow/memory-session-store';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const session = getShadowSessionForUser(auth.userId);
  const active = session && isSessionActive(session);
  const md = active
    ? `# Shadow transition report\n\n**Session:** ${session.client_name}\n**Day:** ${session.day_number}\n\nObservation data is still accumulating. Re-run this export after sync jobs have processed.\n`
    : '# Shadow transition report\n\nNo active shadow session. Activate shadow mode from the dashboard first.\n';

  return jsonOk({
    session_id: session?.id ?? '',
    score: session?.readiness_score ?? 0,
    ready_for_transition: false,
    report_markdown: md,
    generated_at: new Date().toISOString(),
  });
}
