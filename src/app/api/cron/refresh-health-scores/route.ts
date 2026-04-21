import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

/**
 * Refresh Health Scores Cron Job
 *
 * Schedule: Daily at midnight UTC (0 0 * * *)
 * Forwards to `API_UPSTREAM_URL` when configured.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Refresh health scores');
    if (base instanceof NextResponse) return base;

    const response = await fetch(
      `${base}/api/cron/refresh-health-scores`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Refresh health scores cron", {
      personasClassified: data.personas_classified,
      ranAt: data.ran_at,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Refresh health scores cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
