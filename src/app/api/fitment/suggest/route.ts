import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { generateSuggestions } from '@/lib/fitment/fitment-service';

/** Drafts "suggested" rows from Cin7 BOMs and past orders. Existing rows are left alone. */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const res = await generateSuggestions(ids, scope.userId);
    return NextResponse.json({
      from_bom: res.fromBom,
      from_orders: res.fromOrders,
      skipped_existing: res.skippedExisting,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
