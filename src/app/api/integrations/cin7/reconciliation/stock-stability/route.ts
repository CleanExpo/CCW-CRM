import { requireAuthScope } from '@/lib/auth/data-scope';
import { getCin7StockStability } from '@/lib/integrations/cin7-stock-stability';
import { NextRequest, NextResponse } from 'next/server';

/** Last three complete acceptance Cin7 stock counts + prune lock / revert how-to. */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const report = await getCin7StockStability(scope.userId);
  return NextResponse.json(report);
}
