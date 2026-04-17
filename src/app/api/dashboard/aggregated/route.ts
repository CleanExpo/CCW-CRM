import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const [
      products,
      customers,
      ordersCount,
      quotesSent,
      deliveredOrders,
      activeOrders,
      lowStock,
      recentOrders,
      allProducts,
      topProductsData,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.quote.count({ where: { status: 'sent' } }),
      prisma.order.findMany({ where: { status: 'delivered' }, select: { total: true } }),
      prisma.order.count({
        where: { NOT: { status: { in: ['delivered', 'cancelled'] } } },
      }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 10 } } }),
      prisma.order.findMany({
        select: { orderNumber: true, status: true, total: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { category: true, price: true, stock: true },
      }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { name: true, price: true, stock: true },
        orderBy: { price: 'desc' },
        take: 5,
      }),
    ]);

    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const categoryMap = new Map<string, number>();
    let totalCategoryValue = 0;
    allProducts.forEach((p) => {
      const cat = p.category || 'accessories';
      const val = Number(p.price || 0) * Number(p.stock || 0);
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + val);
      totalCategoryValue += val;
    });

    const categorySales = Array.from(categoryMap.entries()).map(([category, value]) => ({
      category: category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      value: value.toFixed(2),
      percentage: totalCategoryValue > 0 ? Math.round((value / totalCategoryValue) * 100) : 0,
    }));

    const topProducts = topProductsData.map((p) => ({
      name: p.name,
      revenue: (Number(p.price || 0) * Number(p.stock || 0)).toFixed(2),
      quantity_sold: Number(p.stock || 0),
    }));

    const recentActivity = recentOrders.map((o) => ({
      type: 'order',
      title: `Order ${o.orderNumber}`,
      description: `Status: ${o.status} - $${Number(o.total || 0).toFixed(2)}`,
      timestamp: o.createdAt,
      status: o.status,
    }));

    return NextResponse.json({
      metrics: {
        total_revenue_this_month: totalRevenue.toFixed(2),
        active_orders: activeOrders,
        total_products: products,
        total_customers: customers,
        low_stock_alerts: lowStock,
        pending_quotes: quotesSent,
      },
      revenue_chart: [],
      category_sales: categorySales,
      top_products: topProducts,
      inventory_status: [],
      recent_activity: recentActivity,
    });
  } catch {
    return NextResponse.json({ detail: 'Failed to load dashboard data' }, { status: 500 });
  }
}
