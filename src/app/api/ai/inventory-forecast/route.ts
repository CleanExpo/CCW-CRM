import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getInventoryForecast } from '@/lib/reorder-radar/radar-service';
import { todayInBrisbane } from '@/lib/reorder-radar/as-of';

/**
 * UNI-2749: demand forecast from customer reorder cadence (replaces the empty
 * placeholder). Body: { product_id?, forecast_days? }.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const days = Number(body.forecast_days);
    const forecastDays = Number.isFinite(days) && days >= 1 && days <= 365 ? Math.round(days) : 30;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    return NextResponse.json(
      await getInventoryForecast(ids, todayInBrisbane(), {
        productId: typeof body.product_id === 'string' ? body.product_id : null,
        forecastDays,
      })
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
