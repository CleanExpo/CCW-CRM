import { NextRequest, NextResponse } from 'next/server';
import { jsonOk, readJsonBody } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';
import {
  createShadowSessionRecord,
  getShadowSessionForUser,
  isSessionActive,
  upsertShadowSession,
  type ShadowSessionRecord,
} from '@/lib/shadow/memory-session-store';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const session = getShadowSessionForUser(auth.userId);
  if (!session || !isSessionActive(session)) {
    return NextResponse.json(null);
  }
  return jsonOk(session);
}

export async function POST(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const raw = body.body as Record<string, unknown>;
  const client_name = typeof raw.client_name === 'string' ? raw.client_name : undefined;
  const notes = typeof raw.notes === 'string' ? raw.notes : raw.notes === null ? null : undefined;
  const duration_days =
    typeof raw.duration_days === 'number' && Number.isFinite(raw.duration_days)
      ? Math.floor(raw.duration_days)
      : undefined;

  const session: ShadowSessionRecord = createShadowSessionRecord({
    client_name,
    notes: notes ?? null,
    duration_days,
  });
  upsertShadowSession(auth.userId, session);
  return jsonOk(session, { status: 201 });
}
