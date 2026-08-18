import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCin7StockStability } from '@/lib/integrations/cin7-stock-stability';
import { NextRequest, NextResponse } from 'next/server';

/** D10 freeze prune lock plus observational live Cin7 stock counts. */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const report = await getCin7StockStability(scope.userId);
  return NextResponse.json(report);
}
