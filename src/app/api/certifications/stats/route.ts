import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/**
 * GET /api/certifications/stats
 * Technician / IICRC certification expiry rollup for the dashboard urgent strip.
 *
 * Returns stable empty aggregates until technician certifications are modeled in the database.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    return NextResponse.json({ expiring_soon: 0, expiring_alerts: [] });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
