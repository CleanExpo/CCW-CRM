import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Shadow Sync Cin7 Cron Job
 *
 * Schedule: Daily at 7:00 AM AEST / 19:00 UTC (0 19 * * *)
 * Proxies to FastAPI backend to pull all products, orders, customers,
 * and inventory from Cin7 into shadow mode for flow analysis.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    const response = await fetch(`${backendUrl}/api/cron/shadow-sync-cin7`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info("Shadow sync Cin7 cron", {
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
    logger.error("Shadow sync Cin7 cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
