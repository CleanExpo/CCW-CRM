import { NextResponse } from "next/server";

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://localhost:9090";

interface TargetInfo {
  job: string;
  health: "up" | "down" | "unknown";
  lastScrape: string;
  lastError: string;
  scrapeUrl: string;
}

/**
 * GET /api/monitoring/health
 *
 * Returns health status of all monitored services by querying Prometheus targets.
 */
export async function GET() {
  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/targets`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Prometheus unreachable: ${res.statusText}`);
    }

    const json = await res.json();
    const activeTargets = json?.data?.activeTargets || [];

    const services: TargetInfo[] = activeTargets.map((t: any) => ({
      job: t.labels?.job || "unknown",
      health: t.health || "unknown",
      lastScrape: t.lastScrape || "",
      lastError: t.lastError || "",
      scrapeUrl: t.scrapeUrl || "",
    }));

    // Query uptime for each service
    const uptimeQueries = await Promise.allSettled([
      queryPrometheus("process_uptime_seconds{job='ccw-backend'}"),
      queryPrometheus("redis_uptime_in_seconds"),
      queryPrometheus("pg_postmaster_start_time_seconds"),
    ]);

    const redisUptime = extractValue(uptimeQueries[1]);
    const pgStartTime = extractValue(uptimeQueries[2]);

    return NextResponse.json({
      prometheus: "up",
      services,
      uptime: {
        redis_seconds: redisUptime,
        postgres_start_time: pgStartTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching monitoring health:", error);
    return NextResponse.json({
      prometheus: "down",
      services: [],
      uptime: {},
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

async function queryPrometheus(query: string): Promise<any> {
  const res = await fetch(
    `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

function extractValue(result: PromiseSettledResult<any>): number | null {
  if (result.status !== "fulfilled" || !result.value) return null;
  const data = result.value?.data?.result?.[0]?.value;
  return data ? parseFloat(data[1]) : null;
}
