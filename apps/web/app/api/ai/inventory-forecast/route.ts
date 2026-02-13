import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    forecasts: [],
    reorder_recommendations: [],
    total_products_analyzed: 0,
    confidence: 0,
  });
}
