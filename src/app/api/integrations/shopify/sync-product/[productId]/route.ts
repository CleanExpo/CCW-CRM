import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getConfiguredShopifyFromRequest, shopifyAdminJson } from '@/lib/integrations/shopify';
import { findProductVariantBySku } from '@/lib/integrations/shopify-ops';

/**
 * Pushes ERP product title / variant price to Shopify by SKU lookup (GraphQL → REST update).
 */
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

  const p = await prisma.product.findFirst({
    where: { id: productId, ownerUserId: scope.userId, isActive: true },
    select: { id: true, sku: true, name: true, price: true },
  });
  if (!p) {
    return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
  }

  const sku = p.sku.trim();
  if (!sku) {
    return NextResponse.json({ detail: 'Product has no SKU.' }, { status: 400 });
  }

  const mapped = await findProductVariantBySku(creds.adminHost, creds.accessToken, sku);
  if (!mapped) {
    return NextResponse.json(
      {
        success: false,
        mode: 'live' as const,
        product_id: p.id,
        sku,
        error: 'No Shopify variant found for SKU',
      },
      { status: 404 }
    );
  }

  const pid = Number(mapped.productId);
  const vid = Number(mapped.variantId);
  const updateBody = {
    product: {
      id: pid,
      title: p.name,
      variants: [{ id: vid, price: String(p.price), sku }],
    },
  };

  const putRes = await shopifyAdminJson<{ product?: { id: number } }>(
    creds.adminHost,
    creds.accessToken,
    `/products/${pid}.json`,
    {
      method: 'PUT',
      body: JSON.stringify(updateBody),
    }
  );

  if (!putRes.ok) {
    return NextResponse.json(
      {
        success: false,
        mode: 'live' as const,
        product_id: p.id,
        sku,
        error: `Shopify product update failed (${putRes.status}).`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    mode: 'live' as const,
    product_id: p.id,
    sku,
    shopify_product_id: pid,
    shopify_variant_id: vid,
  });
}
