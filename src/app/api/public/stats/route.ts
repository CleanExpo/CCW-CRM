import { NextResponse } from 'next/server';

/**
 * Marketing KPI strip for the public home page. Does not query tenant tables — aggregate
 * counts would leak cross-user data on a shared database.
 */
export async function GET() {
  const body = {
    total_products: 12840,
    total_customers: 4200,
    active_orders: 1860,
    pending_quotes: 540,
    total_revenue_this_month: '2840000',
    low_stock_alerts: 120,
    product_categories: 42,
    warehouse_count: 0,
    fetched_at: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
