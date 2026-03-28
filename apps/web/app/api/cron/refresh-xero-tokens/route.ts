import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Refresh Xero Tokens Cron Job
 *
 * Schedule: Every 15 minutes (*/15 * * * *)
 * Proxies to FastAPI backend to proactively refresh Xero OAuth
 * tokens before they expire, preventing token-related API failures.
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
      `${backendUrl}/api/cron/refresh-xero-tokens`,
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
      status: data.status,
      refreshed: data.refreshed,
      failed: data.failed,
      timestamp: new Date().toISOString(),
    });

    if (data.failed > 0) {
      logger.error("Xero token refresh had failures", {
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
