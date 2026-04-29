import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getConfiguredShopifyFromRequest } from '@/lib/integrations/shopify';
import { findVariantInventoryItemId, setInventoryLevel } from '@/lib/integrations/shopify-ops';

export async function POST(request: NextRequest) {
  const creds = getConfiguredShopifyFromRequest(request);
  if (!creds) {
    return NextResponse.json({ detail: 'Shopify is not configured or token is missing.' }, { status: 401 });
  }

  const locationId = process.env.SHOPIFY_INVENTORY_LOCATION_ID?.trim();
  if (!locationId) {
    return NextResponse.json(
      {
        detail:
          'Set SHOPIFY_INVENTORY_LOCATION_ID to your Shopify location id (Admin → Settings → Locations, or GET /admin/api/.../locations.json).',
      },
      { status: 400 }
    );
  }

  const maxProducts = Math.max(1, Math.min(500, Number(request.nextUrl.searchParams.get('max_products') || 200)));

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, stock: true },
    take: maxProducts,
  });

  const results: Array<{
    success: boolean;
    product_id: string;
    sku: string;
    stock: number;
    shopify_product_id?: number;
    error?: string;
  }> = [];

  let synced = 0;
  let failed = 0;

  for (const p of products) {
    const sku = p.sku.trim();
    if (!sku) {
      failed += 1;
      results.push({
        success: false,
        product_id: p.id,
        sku: p.sku,
        stock: p.stock,
        error: 'Empty SKU',
      });
      continue;
    }
    try {
      const variant = await findVariantInventoryItemId(creds.adminHost, creds.accessToken, sku);
      if (!variant) {
        failed += 1;
        results.push({
          success: false,
          product_id: p.id,
          sku,
          stock: p.stock,
          error: 'No Shopify variant found for SKU',
        });
        continue;
      }
      await setInventoryLevel(creds.adminHost, creds.accessToken, locationId, variant.inventoryItemId, p.stock);
      synced += 1;
      results.push({
        success: true,
        product_id: p.id,
        sku,
        stock: p.stock,
      });
    } catch (e) {
      failed += 1;
      results.push({
        success: false,
        product_id: p.id,
        sku,
        stock: p.stock,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    success: failed === 0,
    mode: 'live',
    total: products.length,
    synced,
    failed,
    results,
  });
}
