import { NextRequest, NextResponse } from "next/server";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

export async function GET(request: NextRequest) {
  try {
    const base = requireUpstreamBase('Analytics metrics overview');
    if (base instanceof NextResponse) return base;

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("time_range") || "7d";

    const response = await fetch(
      `${base}/api/analytics/metrics/overview?time_range=${timeRange}`
    );

    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching analytics metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
