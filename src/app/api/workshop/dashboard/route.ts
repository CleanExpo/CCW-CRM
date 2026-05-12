import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/**
 * Workshop home metrics — stub until workshop tables back this with real bookings/reminders.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const location = new URL(request.url).searchParams.get('location')?.trim() || 'all';

  return NextResponse.json({
    location,
    today: { bookings: [], count: 0 },
    this_week: { booking_count: 0 },
    overdue_equipment_count: 0,
    pending_reminders_count: 0,
    upcoming_30_days: {} as Record<string, number>,
  });
}
