import { NextRequest, NextResponse } from "next/server";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://localhost:9090";

/**
 * GET /api/monitoring/range?query=...&start=...&end=...&step=...
 *
 * Queries Prometheus range API for time-series chart data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const duration = searchParams.get("duration") || "1h";
    const step = searchParams.get("step") || "60";

    if (!query) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 }
      );
    }

    // Calculate time range
    const end = Math.floor(Date.now() / 1000);
    const durationSeconds = parseDuration(duration);
    const start = end - durationSeconds;

    const url = new URL(`${PROMETHEUS_URL}/api/v1/query_range`);
    url.searchParams.set("query", query);
    url.searchParams.set("start", start.toString());
    url.searchParams.set("end", end.toString());
    url.searchParams.set("step", step);

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Prometheus query failed: ${res.statusText}`);
    }

    const json = await res.json();
    const results = json?.data?.result || [];

    // Transform to chart-friendly format
    const series = results.map((r: any) => ({
      metric: r.metric,
      values: (r.values || []).map(([timestamp, value]: [number, string]) => ({
        time: new Date(timestamp * 1000).toISOString(),
        timestamp,
        value: parseFloat(value),
      })),
    }));

    return NextResponse.json({ series, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Error fetching range metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch range metrics", series: [] },
      { status: 500 }
    );
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600; // default 1 hour

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    case "d": return value * 86400;
    default: return 3600;
  }
}
