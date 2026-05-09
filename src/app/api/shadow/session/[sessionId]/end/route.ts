import { NextRequest } from 'next/server';
import { jsonDetail, jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import { getShadowSessionForUser, upsertShadowSession } from '@/lib/shadow/memory-session-store';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;
  const current = getShadowSessionForUser(auth.userId);
  if (!current || current.id !== sessionId) {
    return jsonDetail('Session not found', 404);
  }

  const now = new Date().toISOString();
  const ended = {
    ...current,
    status: 'completed',
    completed_at: now,
    updated_at: now,
  };
  upsertShadowSession(auth.userId, ended);
  return jsonOk(ended);
}
