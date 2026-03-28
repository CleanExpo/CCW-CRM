import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Check SLA Breaches Cron Job
 *
 * Schedule: Every 15 minutes (*/15 * * * *)
 * UNI-174 ST-4: Proxies to FastAPI backend to scan for SLA instances
 * past their deadline and fire escalation workflows.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    const response = await fetch(
      `${backendUrl}/api/cron/check-sla-breaches`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Check SLA breaches cron", {
      breachedCount: data.breached_count,
      checkedAt: data.checked_at,
      timestamp: new Date().toISOString(),
    });

    if (data.breached_count > 0) {
      logger.warn("SLA breaches detected", {
        count: data.breached_count,
      });
    }

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Check SLA breaches cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
