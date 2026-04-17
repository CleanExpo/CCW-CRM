import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Cleanup Old Runs Cron Job
 *
 * Schedule: Daily at 2:00 AM UTC (0 2 * * *)
 * Deletes completed/failed agent runs older than 30 days
 * to keep the database lean and performant.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.agentRun.deleteMany({
      where: {
        status: { in: ["completed", "failed"] },
        completedAt: { lt: thirtyDaysAgo },
      },
    });

    const deletedCount = result.count;

    logger.info("Cleanup old runs cron", {
      deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Cleanup old runs cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
