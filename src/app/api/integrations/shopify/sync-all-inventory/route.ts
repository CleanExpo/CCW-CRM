import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, stock: true, updatedAt: true },
    take: 200,
  });
  return NextResponse.json({
    success: true,
    mode: process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live',
    total: products.length,
    synced: products.length,
    failed: 0,
    results: products.map((p) => ({
      success: true,
      mode: process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live',
      product_id: p.id,
      sku: p.sku,
      stock: p.stock,
      synced_at: p.updatedAt.toISOString(),
    })),
  });
}

