import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { logCallOutcome, RadarInputError } from '@/lib/reorder-radar/radar-service';

/** UNI-2749: one-click "log call outcome". Body: { customer_id, outcome, product_id?, notes? }. */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.customer_id !== 'string' || body.customer_id === '') {
      return NextResponse.json({ detail: 'customer_id is required' }, { status: 400 });
    }
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const row = await logCallOutcome(ids, scope.userId, {
      customerId: String(body.customer_id ?? ''),
      outcome: String(body.outcome ?? ''),
      productId: body.product_id ?? null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    });
    if (!row) return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ id: row.id, subject: row.subject }, { status: 201 });
  } catch (e) {
    if (e instanceof RadarInputError)
      return NextResponse.json({ detail: e.message }, { status: 400 });
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
