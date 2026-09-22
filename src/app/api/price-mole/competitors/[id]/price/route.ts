import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as mole from '@/lib/price-mole/price-mole-service';

/** Record a price staff saw themselves. Body: { price }. Dated now, source "manual". */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const body = await request.json();
    const row = await mole.recordManualPrice(ids, id, Number(body.price));
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    if (e instanceof mole.PriceMoleInputError) {
      return NextResponse.json({ detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
