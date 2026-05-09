import { NextRequest } from 'next/server';
import { jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import { getShadowSessionForUser, isSessionActive } from '@/lib/shadow/memory-session-store';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const session = getShadowSessionForUser(auth.userId);
  const active = session !== null && isSessionActive(session);

  return jsonOk({
    active,
    session: active ? session : null,
    day_number: session?.day_number ?? 0,
    days_remaining: session?.days_remaining ?? 0,
    readiness_score: session?.readiness_score ?? null,
  });
}
