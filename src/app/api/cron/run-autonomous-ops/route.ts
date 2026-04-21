import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

/**
 * Autonomous Ops Cron Job
 *
 * Schedule: Every hour (0 * * * *)
 * Forwards to `API_UPSTREAM_URL` when configured.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Autonomous ops');
    if (base instanceof NextResponse) return base;

    const response = await fetch(
      `${base}/api/cron/run-autonomous-ops`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Autonomous ops cron", {
      status: data.status,
      runId: data.run_id,
      actionsTaken: data.actions_taken,
      timestamp: new Date().toISOString(),
    });

    if (data.status === "error") {
      logger.error("Autonomous ops failed", { error: data.error });
    }

    return NextResponse.json({
      success: response.ok && data.status !== "error",
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Autonomous ops cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
