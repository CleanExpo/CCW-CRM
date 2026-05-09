import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const threshold = parseInt(searchParams.get('threshold') || '20', 10);

    const products = await prisma.product.findMany({
      where: { isActive: true, ownerUserId: scope.userId },
      select: { id: true, sku: true, name: true, stock: true, warehouseLocation: true },
    });

    const buildStockByLocation = (p: { stock: number; warehouseLocation: string | null }) => [
      {
        location: p.warehouseLocation || 'brisbane',
        stock: p.stock,
        reserved: 0,
        available: p.stock,
      },
    ];

    const critical = products
      .filter((p) => p.stock === 0)
      .map((p) => ({
        product_id: p.id,
        product_sku: p.sku,
        product_name: p.name,
        total_stock: p.stock,
        total_reserved: 0,
        total_available: p.stock,
        locations: buildStockByLocation(p),
      }));

    const low = products
      .filter((p) => p.stock > 0 && p.stock <= threshold)
      .map((p) => ({
        product_id: p.id,
        product_sku: p.sku,
        product_name: p.name,
        total_stock: p.stock,
        total_reserved: 0,
        total_available: p.stock,
        locations: buildStockByLocation(p),
      }));

    return NextResponse.json({
      critical,
      low,
      warning: [],
    });
  } catch {
    return NextResponse.json({ critical: [], low: [], warning: [] }, { status: 500 });
  }
}
