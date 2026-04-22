import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Anonymous marketing KPIs for the public home page (`LiveStatsBar`).
 * No auth — keep aggregates only; do not expose row-level data.
 */
export async function GET() {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      total_products,
      total_customers,
      active_orders,
      pending_quotes,
      low_stock_alerts,
      categoryGroups,
      revenueAgg,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.order.count({
        where: { NOT: { status: { in: ['delivered', 'cancelled'] } } },
      }),
      prisma.quote.count({
        where: { status: { in: ['draft', 'pending', 'sent'] } },
      }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 10 } } }),
      prisma.product.groupBy({
        by: ['category'],
        where: { isActive: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          status: { notIn: ['cancelled'] },
        },
        _sum: { total: true },
      }),
    ]);

    const product_categories = categoryGroups.filter(
      (g) => g.category != null && String(g.category).trim() !== ''
    ).length;

    const body = {
      total_products,
      total_customers,
      active_orders,
      pending_quotes,
      total_revenue_this_month: String(revenueAgg._sum.total ?? 0),
      low_stock_alerts,
      product_categories,
      warehouse_count: 0,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch {
    return NextResponse.json({ error: 'stats_unavailable' }, { status: 503 });
  }
}
