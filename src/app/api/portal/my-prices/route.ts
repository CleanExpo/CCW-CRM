import { NextRequest, NextResponse } from 'next/server';
import { withPortalOrdering } from '@/lib/portal/ordering-route';
import { listMyPrices } from '@/lib/portal/my-price';

/** UNI-2747: products at the signed-in customer's own price. */
export async function GET(request: NextRequest) {
  return withPortalOrdering(request, async (customerId) => {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(sp.get('page_size') || '50', 10) || 50, 1), 100);
    const res = await listMyPrices(customerId, {
      search: sp.get('search') || undefined,
      page,
      pageSize,
    });
    return NextResponse.json({ ...res, page, page_size: pageSize });
  });
}
