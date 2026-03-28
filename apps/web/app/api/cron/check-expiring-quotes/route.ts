import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Check Expiring Quotes Cron Job
 *
 * Schedule: Daily at 9:00 AM UTC (0 9 * * *)
 * Proxies to FastAPI backend to check for quotes expiring
 * within 3 days and send notifications to relevant users.
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
      `${backendUrl}/api/cron/check-expiring-quotes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Check expiring quotes cron", {
      notificationsSent: data.notifications_sent,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Check expiring quotes cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
