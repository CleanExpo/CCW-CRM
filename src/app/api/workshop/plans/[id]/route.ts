import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { cancelServicePlan } from '@/lib/workshop/service-plans';

/** UNI-2750: cancel a plan. The row is kept with status "cancelled". */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    if (!(await cancelServicePlan(ids, id))) {
      return NextResponse.json({ detail: 'Active plan not found' }, { status: 404 });
    }
    return NextResponse.json({ cancelled: true });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
