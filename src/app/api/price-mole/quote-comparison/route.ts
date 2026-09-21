import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getQuoteComparison } from '@/lib/price-mole/price-mole-service';

/** ?skus=A,B or ?product_ids=x,y — CCW price, confirmed competitor prices (dated) and margin at match. */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const sp = new URL(request.url).searchParams;
    const list = (key: string) =>
      (sp.get(key) ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
    const skus = list('skus');
    const productIds = list('product_ids');
    if (skus.length === 0 && productIds.length === 0) return NextResponse.json({ items: [] });
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    return NextResponse.json({ items: await getQuoteComparison(ids, { skus, productIds }) });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
