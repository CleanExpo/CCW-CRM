import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();

    const [products, customers, orders, quotes] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    ]);

    // Get revenue from delivered orders
    const { data: deliveredOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('status', 'delivered');

    const totalRevenue = deliveredOrders?.reduce((sum, o) => sum + Number(o.total || 0), 0) ?? 0;

    // Get active orders (not delivered/cancelled)
    const { count: activeOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("delivered","cancelled")');

    // Get low stock items
    const { count: lowStock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .lte('stock', 10);

    // Get recent orders for activity feed
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('order_number, status, total, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get category breakdown from products
    const { data: allProducts } = await supabase
      .from('products')
      .select('category, price, stock')
      .eq('is_active', true);

    // Build category sales data
    const categoryMap = new Map<string, number>();
    let totalCategoryValue = 0;
    allProducts?.forEach((p) => {
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

    // Build top products
    const { data: topProductsData } = await supabase
      .from('products')
      .select('name, price, stock')
      .eq('is_active', true)
      .order('price', { ascending: false })
      .limit(5);

    const topProducts =
      topProductsData?.map((p) => ({
        name: p.name,
        revenue: (Number(p.price || 0) * Number(p.stock || 0)).toFixed(2),
        quantity_sold: Number(p.stock || 0),
      })) ?? [];

    // Build recent activity from orders
    const recentActivity =
      recentOrders?.map((o) => ({
        type: 'order',
        title: `Order ${o.order_number}`,
        description: `Status: ${o.status} - $${Number(o.total || 0).toFixed(2)}`,
        timestamp: o.created_at,
        status: o.status,
      })) ?? [];

    // Return the nested structure the dashboard expects
    return NextResponse.json({
      metrics: {
        total_revenue_this_month: totalRevenue.toFixed(2),
        active_orders: activeOrders ?? 0,
        total_products: products.count ?? 0,
        total_customers: customers.count ?? 0,
        low_stock_alerts: lowStock ?? 0,
        pending_quotes: quotes.count ?? 0,
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
