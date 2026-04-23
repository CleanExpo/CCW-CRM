import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function buildLastSixMonthBuckets(reference: Date) {
  const months: { start: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    months.push({
      start: d,
      label: d.toLocaleString('en-AU', { month: 'short' }),
    });
  }
  return months;
}

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      products,
      customers,
      quotesSent,
      revenueThisMonthAgg,
      deliveredForTrend,
      deliveredTotalsAgg,
      deliveredOrderCount,
      activeOrders,
      lowStock,
      lowStockSamples,
      recentOrders,
      recentQuotes,
      allProducts,
      topProductsByPrice,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.quote.count({ where: { status: 'sent' } }),
      prisma.order.aggregate({
        where: {
          status: 'delivered',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: {
          status: 'delivered',
          createdAt: { gte: trendStart, lte: monthEnd },
        },
        select: { total: true, createdAt: true },
      }),
      prisma.order.aggregate({
        where: { status: 'delivered' },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { status: 'delivered' } }),
      prisma.order.count({
        where: { NOT: { status: { in: ['delivered', 'cancelled'] } } },
      }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 10 } } }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: 10 } },
        orderBy: { stock: 'asc' },
        take: 2,
        select: { name: true, sku: true, stock: true },
      }),
      prisma.order.findMany({
        select: { orderNumber: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.quote.findMany({
        select: { quoteNumber: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { category: true, price: true, stock: true, name: true, sku: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { name: true, price: true, stock: true },
        orderBy: { price: 'desc' },
        take: 5,
      }),
    ]);

    const totalRevenue = Number(revenueThisMonthAgg._sum.total ?? 0);

    const monthBuckets = buildLastSixMonthBuckets(now);
    const revenueByYm = new Map<string, number>();
    for (const m of monthBuckets) {
      revenueByYm.set(`${m.start.getFullYear()}-${m.start.getMonth()}`, 0);
    }
    for (const row of deliveredForTrend) {
      const d = row.createdAt;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!revenueByYm.has(key)) continue;
      revenueByYm.set(key, (revenueByYm.get(key) ?? 0) + Number(row.total || 0));
    }
    const revenue_chart = monthBuckets.map((m) => ({
      month: m.label,
      revenue: (revenueByYm.get(`${m.start.getFullYear()}-${m.start.getMonth()}`) ?? 0).toFixed(
        2
      ),
    }));

    const categoryMap = new Map<string, number>();
    let totalInventoryValue = 0;
    allProducts.forEach((p) => {
      const cat = p.category || 'accessories';
      const val = Number(p.price || 0) * Number(p.stock || 0);
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + val);
      totalInventoryValue += val;
    });

    const totalDeliveredAllTime = Number(deliveredTotalsAgg._sum.total ?? 0);
    const formatCategory = (category: string) =>
      category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    /** Until order line items exist in DB, split delivered revenue by inventory value share per category. */
    const categorySales =
      totalInventoryValue > 0 && totalDeliveredAllTime > 0
        ? Array.from(categoryMap.entries()).map(([category, invVal]) => {
            const share = invVal / totalInventoryValue;
            const allocated = totalDeliveredAllTime * share;
            return {
              category: formatCategory(category),
              value: allocated.toFixed(2),
              percentage:
                totalDeliveredAllTime > 0
                  ? Math.round((allocated / totalDeliveredAllTime) * 100)
                  : 0,
            };
          })
        : Array.from(categoryMap.entries()).map(([category, value]) => ({
            category: formatCategory(category),
            value: value.toFixed(2),
            percentage:
              totalInventoryValue > 0 ? Math.round((value / totalInventoryValue) * 100) : 0,
          }));

    const topProducts =
      totalInventoryValue > 0 && totalDeliveredAllTime > 0
        ? [...allProducts]
            .map((p) => {
              const lineValue = Number(p.price || 0) * Number(p.stock || 0);
              const share = lineValue / totalInventoryValue;
              const revenue = totalDeliveredAllTime * share;
              const unitsProxy = Math.max(0, Math.round(share * deliveredOrderCount));
              return {
                name: p.name,
                revenue: revenue.toFixed(2),
                quantity_sold: unitsProxy,
              };
            })
            .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
            .slice(0, 5)
        : topProductsByPrice.map((p) => ({
            name: p.name,
            revenue: (Number(p.price || 0) * Number(p.stock || 0)).toFixed(2),
            quantity_sold: Number(p.stock || 0),
          }));

    const commercialActivity = [
      ...recentOrders.map((o) => ({
        type: 'order',
        title: `Order ${o.orderNumber}`,
        description: `Status: ${o.status} — $${Number(o.total || 0).toFixed(2)}`,
        timestamp: o.createdAt.toISOString(),
        status: o.status,
      })),
      ...recentQuotes.map((q) => ({
        type: 'quote',
        title: `Quote ${q.quoteNumber}`,
        description: `Status: ${q.status} — $${Number(q.total ?? 0).toFixed(2)}`,
        timestamp: q.createdAt.toISOString(),
        status: q.status,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const stockActivity =
      lowStockSamples.length > 0
        ? lowStockSamples.map((p) => ({
            type: 'stock',
            title: `Low stock: ${p.name}`,
            description: `SKU ${p.sku} · ${p.stock} on hand — review reorder`,
            timestamp: now.toISOString(),
            status: 'low_stock',
          }))
        : [];

    const recentActivity = [
      ...commercialActivity.slice(0, lowStockSamples.length > 0 ? 4 : 6),
      ...stockActivity,
    ].slice(0, 6);

    const categorySalesNonZero = categorySales.filter((c) => parseFloat(c.value) >= 0.01);

    return NextResponse.json({
      metrics: {
        total_revenue_this_month: totalRevenue.toFixed(2),
        active_orders: activeOrders,
        total_products: products,
        total_customers: customers,
        low_stock_alerts: lowStock,
        pending_quotes: quotesSent,
      },
      revenue_chart,
      category_sales: categorySalesNonZero,
      top_products: topProducts,
      inventory_status: [],
      recent_activity: recentActivity,
    });
  } catch {
    return NextResponse.json({ detail: 'Failed to load dashboard data' }, { status: 500 });
  }
}
