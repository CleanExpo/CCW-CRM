import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { bookFromPlan, ServicePlanError } from '@/lib/workshop/service-plans';

/**
 * UNI-2750: staff booking from a ready-to-book recall row, with the plan's
 * template and parts kit. Staff diary only; no customer is contacted.
 * Body: { scheduled_date? }.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { equipmentId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const res = await bookFromPlan(
      ids,
      scope.userId,
      equipmentId,
      typeof body.scheduled_date === 'string' ? body.scheduled_date : undefined
    );
    return NextResponse.json(
      { created: res.created, booking_id: res.bookingId, parts: res.parts },
      { status: res.created ? 201 : 200 }
    );
  } catch (e) {
    if (e instanceof ServicePlanError) {
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
