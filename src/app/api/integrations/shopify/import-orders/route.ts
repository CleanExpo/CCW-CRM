import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  const maxOrders = Math.max(
    1,
    Math.min(100, Number(request.nextUrl.searchParams.get('max_orders') || 50))
  );
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: maxOrders,
    select: { id: true, orderNumber: true, total: true, status: true },
  });
  return NextResponse.json({
    success: true,
    mode: process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live',
    imported_count: orders.length,
    orders: orders.map((o) => ({
      id: o.id,
      order_number: o.orderNumber,
      total: o.total,
      status: o.status,
    })),
  });
}

