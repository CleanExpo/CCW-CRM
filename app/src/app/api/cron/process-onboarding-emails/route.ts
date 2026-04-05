import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * Process Onboarding Emails Cron Job
 *
 * Schedule: Daily at 9:00 AM UTC (0 9 * * *)
 * UNI-1113: Proxies to FastAPI backend to send due onboarding
 * touchpoint emails. Processes scheduled touchpoints that are
 * ready to be sent.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/cron/process-onboarding-emails`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Process onboarding emails cron", {
      sent: data.sent,
      failed: data.failed,
      ranAt: data.ran_at,
      timestamp: new Date().toISOString(),
    });

    if (data.failed > 0) {
      logger.error("Onboarding email failures", { failed: data.failed });
    }

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Process onboarding emails cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
