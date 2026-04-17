import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Daily Report Cron Job
 *
 * Schedule: Daily at 9:00 AM UTC (0 9 * * *)
 * Generates a daily summary of agent activity including
 * success rates, failures, and execution times.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const runs = await prisma.agentRun.findMany({
      where: {
        createdAt: { gte: yesterday, lt: today },
      },
    });

    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status === "completed");
    const failedRuns = runs.filter((r) => r.status === "failed");
    const escalatedRuns = runs.filter((r) => r.status === "escalated");

    const successRate =
      totalRuns > 0 ? ((completedRuns.length / totalRuns) * 100).toFixed(1) : "0";

    const executionTimes = completedRuns
      .filter((r) => r.completedAt && r.createdAt)
      .map((r) => new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime());
    const avgExecutionTime =
      executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0;

    const topFailures = failedRuns.slice(0, 5).map((r) => ({
      id: r.id,
      agent: r.agentType,
      error: r.errorMessage?.slice(0, 200),
      created_at: r.createdAt,
    }));

    const report = {
      date: yesterday.toISOString().split("T")[0],
      totalRuns,
      completed: completedRuns.length,
      failed: failedRuns.length,
      escalated: escalatedRuns.length,
      successRate: `${successRate}%`,
      avgExecutionTimeMs: avgExecutionTime,
      topFailures,
    };

    logger.info("Daily report generated", report);

    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Daily report cron error", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
