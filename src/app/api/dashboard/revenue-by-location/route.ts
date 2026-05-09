import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const uid = scope.userId;
    const customers = await prisma.customer.findMany({
      where: { ownerUserId: uid },
      select: { id: true, city: true },
    });
    const orders = await prisma.order.findMany({
      where: { ownerUserId: uid, status: 'delivered' },
      select: { customerId: true, total: true, status: true },
    });

    const customerCityMap = new Map<string, string>();
    for (const c of customers) {
      customerCityMap.set(c.id, c.city || 'Unknown');
    }

    const revenueByCity: Record<string, { revenue: number; order_count: number }> = {};
    for (const order of orders) {
      const city = customerCityMap.get(order.customerId) || 'Unknown';
      if (!revenueByCity[city]) {
        revenueByCity[city] = { revenue: 0, order_count: 0 };
      }
      revenueByCity[city].revenue += Number(order.total || 0);
      revenueByCity[city].order_count += 1;
    }

    const totalRevenue = Object.values(revenueByCity).reduce((sum, v) => sum + v.revenue, 0);

    const locations = Object.entries(revenueByCity).map(([location, stats]) => ({
      location,
      revenue: stats.revenue,
      percentage: totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 100) : 0,
      order_count: stats.order_count,
      average_order_value:
        stats.order_count > 0 ? Math.round(stats.revenue / stats.order_count) : 0,
      growth_percentage: null,
    }));

    return NextResponse.json({
      locations,
      total_revenue: totalRevenue,
      period: 'All time',
    });
  } catch {
    return NextResponse.json(
      { locations: [], total_revenue: 0, period: 'All time' },
      { status: 500 }
    );
  }
}
