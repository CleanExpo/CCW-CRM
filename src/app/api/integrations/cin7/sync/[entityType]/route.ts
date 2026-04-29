import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(
  _request: Request,
  context: { params: Promise<{ entityType: string }> }
) {
  const { entityType } = await context.params;
  const allowed = ['products', 'customers', 'orders', 'inventory'] as const;
  if (!allowed.includes(entityType as (typeof allowed)[number])) {
    return NextResponse.json({ detail: 'Unsupported entity type' }, { status: 400 });
  }

  let recordsProcessed = 0;
  if (entityType === 'products' || entityType === 'inventory') {
    recordsProcessed = await prisma.product.count({ where: { isActive: true } });
  } else if (entityType === 'customers') {
    recordsProcessed = await prisma.customer.count({ where: { isActive: true } });
  } else if (entityType === 'orders') {
    recordsProcessed = await prisma.order.count();
  }

  return NextResponse.json({
    status: 'ok',
    records_processed: recordsProcessed,
  });
}

