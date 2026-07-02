import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getConfiguredShopifyFromRequest } from '@/lib/integrations/shopify';
import { importShopifyOrderToErp } from '@/lib/integrations/shopify-ops';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
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

  const { orderId } = await context.params;
  const id = String(orderId || '').trim();
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json(
      { detail: 'Provide a numeric Shopify order id (from Shopify Admin or the Admin API).' },
      { status: 400 }
    );
  }

  const creds = getConfiguredShopifyFromRequest(request, workspaceId);
  if (!creds) {
    return NextResponse.json({ detail: 'Shopify is not configured or token is missing.' }, { status: 401 });
  }

  try {
    const r = await importShopifyOrderToErp(creds.adminHost, creds.accessToken, id, scope.userId);
    const row = await prisma.order.findFirst({
      where: { id: r.order_id, ownerUserId: scope.userId },
      select: { customerId: true, total: true, status: true },
    });
    return NextResponse.json({
      success: true,
      mode: 'live',
      order_id: r.order_id,
      order_number: r.order_number,
      customer_id: row?.customerId ?? '',
      total: row?.total ?? 0,
      status: row?.status ?? (r.created ? 'imported' : 'exists'),
      shopify_order_id: r.shopify_order_id,
      warnings: r.warnings.length ? r.warnings : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Import failed.' },
      { status: 400 }
    );
  }
}
