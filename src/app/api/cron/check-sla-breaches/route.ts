import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { BACKEND_URL } from '@/lib/api/backend-url';

// Check SLA Breaches Cron Job
// Schedule: Every 15 minutes
// UNI-174 ST-4: Proxies to FastAPI backend to scan for SLA breaches
// and fire escalation notifications.

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/cron/check-sla-breaches`,
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
      breachesFound: data.breaches_found,
      escalationsSent: data.escalations_sent,
      timestamp: new Date().toISOString(),
    });

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
