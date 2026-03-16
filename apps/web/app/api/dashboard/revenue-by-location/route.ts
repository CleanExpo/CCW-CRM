import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: customers } = await supabase
      .from("customers")
      .select("id, city");

    const { data: orders } = await supabase
      .from("orders")
      .select("customer_id, total, status")
      .eq("status", "delivered");

    const customerCityMap = new Map<string, string>();
    for (const c of customers ?? []) {
      customerCityMap.set(c.id, c.city || "Unknown");
    }

    // Aggregate revenue and order count by city
    const revenueByCity: Record<string, { revenue: number; order_count: number }> = {};
    for (const order of orders ?? []) {
      const city = customerCityMap.get(order.customer_id) || "Unknown";
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
      average_order_value: stats.order_count > 0 ? Math.round(stats.revenue / stats.order_count) : 0,
      growth_percentage: null,
    }));

    return NextResponse.json({
      locations,
      total_revenue: totalRevenue,
      period: "All time",
    });
  } catch {
    return NextResponse.json(
      { locations: [], total_revenue: 0, period: "All time" },
      { status: 500 }
    );
  }
}
