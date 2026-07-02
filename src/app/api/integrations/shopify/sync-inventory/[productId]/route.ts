import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getConfiguredShopifyFromRequest } from '@/lib/integrations/shopify';
import { findVariantInventoryItemId, setInventoryLevel } from '@/lib/integrations/shopify-ops';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const { productId } = await context.params;
  const creds = getConfiguredShopifyFromRequest(request, workspaceId);
  if (!creds) {
    return NextResponse.json({ detail: 'Shopify is not configured or token is missing.' }, { status: 401 });
  }

  const locationId = process.env.SHOPIFY_INVENTORY_LOCATION_ID?.trim();
  if (!locationId) {
    return NextResponse.json(
      {
        detail:
          'Set SHOPIFY_INVENTORY_LOCATION_ID to your Shopify location id (Admin → Settings → Locations).',
      },
      { status: 400 }
    );
  }

  const p = await prisma.product.findFirst({
    where: { id: productId, ownerUserId: scope.userId, isActive: true },
    select: { id: true, sku: true, stock: true },
  });
  if (!p) {
    return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
  }

  const sku = p.sku.trim();
  if (!sku) {
    return NextResponse.json(
      { detail: 'Product has no SKU; map a SKU before syncing inventory to Shopify.' },
      { status: 400 }
    );
  }

  try {
    const variant = await findVariantInventoryItemId(creds.adminHost, creds.accessToken, sku);
    if (!variant) {
      return NextResponse.json(
        {
          success: false,
          mode: 'live' as const,
          product_id: p.id,
          sku,
          stock: p.stock,
          error: 'No Shopify variant found for SKU',
        },
        { status: 404 }
      );
    }
    await setInventoryLevel(
      creds.adminHost,
      creds.accessToken,
      locationId,
      variant.inventoryItemId,
      p.stock
    );
    return NextResponse.json({
      success: true,
      mode: 'live' as const,
      product_id: p.id,
      sku,
      stock: p.stock,
      synced_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        mode: 'live' as const,
        product_id: p.id,
        sku,
        stock: p.stock,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}
