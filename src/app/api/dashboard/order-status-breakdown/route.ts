import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { ownerUserId: scope.userId },
      select: { status: true },
    });

    const breakdown: Record<string, number> = {};
    let totalActive = 0;
    for (const order of orders) {
      breakdown[order.status] = (breakdown[order.status] || 0) + 1;
      if (!['delivered', 'cancelled'].includes(order.status)) {
        totalActive++;
      }
    }

    const totalOrders = orders.length;
    const byStatus = Object.entries(breakdown).map(([status, count]) => ({
      status,
      count,
      percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0,
    }));

    return NextResponse.json({
      total_active_orders: totalActive,
      by_status: byStatus,
    });
  } catch {
    return NextResponse.json({ total_active_orders: 0, by_status: [] }, { status: 500 });
  }
}
