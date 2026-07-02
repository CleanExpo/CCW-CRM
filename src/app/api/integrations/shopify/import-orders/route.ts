import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getConfiguredShopifyFromRequest, shopifyAdminJson } from '@/lib/integrations/shopify';
import { importShopifyOrderToErp } from '@/lib/integrations/shopify-ops';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json(
      {
        detail:
          'Not authenticated. For cron, send Authorization: Bearer CRON_SECRET and set CRON_INTEGRATION_USER_ID.',
      },
      { status: 401 }
    );
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const creds = getConfiguredShopifyFromRequest(request, workspaceId);
  if (!creds) {
    return NextResponse.json({ detail: 'Shopify is not configured or token is missing.' }, { status: 401 });
  }

  const maxOrders = Math.max(
    1,
    Math.min(100, Number(request.nextUrl.searchParams.get('max_orders') || 50))
  );

  const { ok, data, status } = await shopifyAdminJson<{ orders?: { id: number }[] }>(
    creds.adminHost,
    creds.accessToken,
    `/orders.json?status=any&limit=${maxOrders}`
  );

  if (!ok) {
    return NextResponse.json(
      { detail: `Shopify orders request failed (${status}).` },
      { status: 502 }
    );
  }

  const orders = data.orders || [];
  const imported: Array<{
    shopify_order_id: number;
    erp_order_id: string;
    order_number: string;
    created: boolean;
    warnings?: string[];
  }> = [];
  const errors: string[] = [];

  for (const o of orders) {
    try {
      const r = await importShopifyOrderToErp(
        creds.adminHost,
        creds.accessToken,
        String(o.id),
        scope.userId
      );
      imported.push({
        shopify_order_id: r.shopify_order_id,
        erp_order_id: r.order_id,
        order_number: r.order_number,
        created: r.created,
        warnings: r.warnings.length ? r.warnings : undefined,
      });
    } catch (e) {
      errors.push(`Order ${o.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0 || imported.length > 0,
    mode: 'live',
    imported_count: imported.length,
    orders: imported,
    errors: errors.length ? errors : null,
  });
}
