import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { buildShopifyPriceListPreview } from '@/lib/integrations/shopify-price-list';

/** UNI-2747 staff preview: ?customer_id=. Never writes to Shopify. */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const customerId = new URL(request.url).searchParams.get('customer_id');
    if (!customerId) {
      return NextResponse.json({ detail: 'customer_id is required' }, { status: 400 });
    }
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const res = await buildShopifyPriceListPreview(ids, customerId);
    if (!res) return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
