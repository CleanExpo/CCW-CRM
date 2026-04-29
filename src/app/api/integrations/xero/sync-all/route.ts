import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  const maxOrders = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('max_orders') || 10)));
  const rows = await prisma.order.findMany({
    where: { status: { in: ['confirmed', 'delivered'] } },
    orderBy: { createdAt: 'desc' },
    take: maxOrders,
    select: { id: true },
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      const url = new URL(`/api/integrations/xero/sync-order/${row.id}`, request.url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });
      if (res.ok) synced += 1;
      else {
        failed += 1;
        const detail = (await res.json().catch(() => ({}))) as { detail?: string };
        errors.push(detail.detail || `Order ${row.id} failed`);
      }
    } catch {
      failed += 1;
      errors.push(`Order ${row.id} failed`);
    }
  }

  return NextResponse.json({
    total: rows.length,
    synced,
    failed,
    errors: errors.length > 0 ? errors : null,
  });
}

