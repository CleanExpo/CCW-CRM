import { NextRequest, NextResponse } from 'next/server';
import { getCin7Mode } from '@/lib/integrations/cin7-core';
import { requireAuthScope } from '@/lib/auth/data-scope';

/** Polling configuration for Cin7 (POST /poll runs a manual poll). */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const mode = getCin7Mode();
  return NextResponse.json({
    polling_enabled: process.env.CIN7_POLLING_ENABLED === '1',
    intervals: {
      products: 15,
      customers: 15,
      sales: 15,
      inventory: 15,
    },
    sync_enabled: {
      products: true,
      customers: true,
      sales: true,
      inventory: true,
    },
    mode,
    checked_at: new Date().toISOString(),
  });
}
