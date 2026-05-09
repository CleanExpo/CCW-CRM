import { NextRequest } from 'next/server';
import { jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import { getShadowSessionForUser } from '@/lib/shadow/memory-session-store';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const session = getShadowSessionForUser(auth.userId);
  return jsonOk({
    session_id: session?.id ?? '',
    day_count: 0,
    stats: [] as unknown[],
  });
}
