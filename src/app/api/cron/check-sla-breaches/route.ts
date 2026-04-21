import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

// Check SLA Breaches Cron Job
// Schedule: Every 15 minutes
// Forwards to `API_UPSTREAM_URL` when configured.

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Check SLA breaches');
    if (base instanceof NextResponse) return base;

    const response = await fetch(
      `${base}/api/cron/check-sla-breaches`,
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
