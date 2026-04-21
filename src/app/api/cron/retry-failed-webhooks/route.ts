import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

// Retry Failed Webhooks Cron Job
// Schedule: Every 5 minutes
// Forwards to `API_UPSTREAM_URL` when configured.

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Retry failed webhooks');
    if (base instanceof NextResponse) return base;

    const response = await fetch(
      `${base}/api/cron/retry-failed-webhooks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Retry failed webhooks cron", {
      status: data.status,
      retried: data.retried,
      succeeded: data.succeeded,
      failed: data.failed,
      timestamp: new Date().toISOString(),
    });

    if (data.failed > 0) {
      logger.error("Webhook retries had failures", {
        failed: data.failed,
        errors: data.errors,
      });
    }

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Retry failed webhooks cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
