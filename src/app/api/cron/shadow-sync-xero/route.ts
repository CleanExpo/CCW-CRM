import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';

/**
 * Shadow Sync Xero Cron Job
 *
 * Schedule: Daily at 8:00 AM AEST / 20:00 UTC (0 20 * * *)
 * Forwards to `API_UPSTREAM_URL` when configured.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const base = requireUpstreamBase('Shadow sync Xero');
    if (base instanceof NextResponse) return base;

    const response = await fetch(`${base}/api/cron/shadow-sync-xero`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info("Shadow sync Xero cron", {
      status: data.status,
      synced: data.synced,
      errors: data.errors?.length ?? 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Shadow sync Xero cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
