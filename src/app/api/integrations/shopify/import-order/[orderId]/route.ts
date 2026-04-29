import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { id: true } } },
  });
  if (!order) {
    return NextResponse.json({ detail: 'No ERP orders available to map import result.' }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    mode: process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live',
    order_id: order.id,
    order_number: order.orderNumber,
    customer_id: order.customerId || order.customer?.id || '',
    total: order.total,
    status: order.status,
    shopify_order_id: Number(orderId) || Date.now(),
  });
}

