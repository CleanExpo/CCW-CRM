import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildCommsHub } from '@/lib/comms/hub';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const limit = Math.min(100, Number(request.nextUrl.searchParams.get('limit') ?? 50));
    const hub = await buildCommsHub(scope.userId, limit);
    return NextResponse.json(hub);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
