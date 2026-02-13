import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threshold = parseInt(searchParams.get("threshold") || "20", 10);

    const supabase = createServerClient();
    const { data: products } = await supabase
      .from("products")
      .select("id, sku, name, stock, warehouse_location")
      .eq("is_active", true);

    const items = products ?? [];

    // Build stock_by_location matching StockByLocation interface: { location, stock, reserved, available }
    const buildStockByLocation = (p: { stock: number; warehouse_location: string | null }) => [
      {
        location: p.warehouse_location || "brisbane",
        stock: p.stock,
        reserved: 0,
        available: p.stock,
      },
    ];

    // Categorize products
    const critical = items
      .filter((p) => p.stock === 0)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock_by_location: buildStockByLocation(p),
        total_available: p.stock,
        min_available: 0,
      }));

    const low = items
      .filter((p) => p.stock > 0 && p.stock <= threshold)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock_by_location: buildStockByLocation(p),
        total_available: p.stock,
        min_available: p.stock,
      }));

    return NextResponse.json({
      critical,
      low,
      warning: [],
    });
  } catch {
    return NextResponse.json(
      { critical: [], low: [], warning: [] },
      { status: 500 }
    );
  }
}
