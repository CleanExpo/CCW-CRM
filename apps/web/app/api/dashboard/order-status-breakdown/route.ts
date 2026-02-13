import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: orders } = await supabase.from("orders").select("status");

    const breakdown: Record<string, number> = {};
    let totalActive = 0;
    for (const order of orders ?? []) {
      breakdown[order.status] = (breakdown[order.status] || 0) + 1;
      if (!["delivered", "cancelled"].includes(order.status)) {
        totalActive++;
      }
    }

    const totalOrders = orders?.length ?? 0;
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
    return NextResponse.json(
      { total_active_orders: 0, by_status: [] },
      { status: 500 }
    );
  }
}
