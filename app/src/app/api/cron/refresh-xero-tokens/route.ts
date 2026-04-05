import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { BACKEND_URL } from '@/lib/api/backend-url';

// Refresh Xero Tokens Cron Job
// Schedule: Every 15 minutes
// Proactively refreshes Xero OAuth tokens before they expire
// to prevent auth failures during business operations.

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const response = await fetch(
      `${BACKEND_URL}/api/cron/refresh-xero-tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Refresh Xero tokens cron", {
      refreshed: data.refreshed,
      skipped: data.skipped,
      errors: data.errors?.length ?? 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Refresh Xero tokens cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
