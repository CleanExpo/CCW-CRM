import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getReorderRadar } from '@/lib/reorder-radar/radar-service';
import { parseAsOf } from '@/lib/reorder-radar/as-of';

/** UNI-2749: the daily staff call list. ?as_of=YYYY-MM-DD replays any past day. */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const asOf = parseAsOf(new URL(request.url).searchParams.get('as_of'));
    if (!asOf) return NextResponse.json({ detail: 'as_of must be YYYY-MM-DD' }, { status: 400 });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    return NextResponse.json(await getReorderRadar(ids, asOf));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
