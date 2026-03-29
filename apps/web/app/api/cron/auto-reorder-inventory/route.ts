import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Auto Reorder Inventory Cron Job
 *
 * Schedule: Daily at 7:00 AM AEST / 21:00 UTC (0 21 * * *)
 * Sprint 4: Proxies to FastAPI backend to scan inventory for products
 * below their reorder point and create draft PurchaseOrders against
 * linked suppliers using reorder rules and lead time calculations.
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
      `${backendUrl}/api/cron/auto-reorder-inventory`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    logger.info("Auto reorder inventory cron", {
      posCreated: data.pos_created,
      productsChecked: data.products_checked,
      skipped: data.skipped,
      ranAt: data.ran_at,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Auto reorder inventory cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
