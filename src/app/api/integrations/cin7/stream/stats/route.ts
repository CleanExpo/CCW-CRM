import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/** Lightweight stats for the Cin7 change stream (SSE is served at ../stream). */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    channel: 'cin7',
    active_connections: 0,
    total_events_sent: 0,
    checked_at: new Date().toISOString(),
  });
}
