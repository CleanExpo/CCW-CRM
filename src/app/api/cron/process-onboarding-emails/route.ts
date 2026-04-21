import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

/**
 * Process Onboarding Emails Cron Job
 *
 * Schedule: Daily at 9:00 AM UTC (0 9 * * *)
 * Forwards to `API_UPSTREAM_URL` when configured.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Process onboarding emails');
    if (base instanceof NextResponse) return base;

    const response = await fetch(
      `${base}/api/cron/process-onboarding-emails`,
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
