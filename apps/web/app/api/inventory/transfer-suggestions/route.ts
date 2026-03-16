import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    suggestions: [],
    total_potential_revenue: 0,
    total_estimated_cost: 0,
  });
}
