import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildCustomerTimeline } from '@/lib/customer-timeline/aggregate';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { customerId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);

    const events = await buildCustomerTimeline(customerId, scope.userId, limit);
    return NextResponse.json({ customer_id: customerId, events, count: events.length });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
