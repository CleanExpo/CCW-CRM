import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as mole from '@/lib/price-mole/price-mole-service';

/** Confirm or reject a competitor match. Body: { status }. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const body = await request.json();
    const row = await mole.reviewMatch(ids, scope.userId, id, String(body.status ?? ''));
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id, match_status: row.matchStatus });
  } catch (e) {
    if (e instanceof mole.PriceMoleInputError) {
      return NextResponse.json({ detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
