import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * Refresh Health Scores Cron Job
 *
 * Schedule: Daily at midnight UTC (0 0 * * *)
 * UNI-1114/1112: Proxies to FastAPI backend to refresh CRM persona tags
 * for all customers. Classifies customers based on health metrics
 * (order frequency, revenue, engagement, etc.).
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/cron/refresh-health-scores`,
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
