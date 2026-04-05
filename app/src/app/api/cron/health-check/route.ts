import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * Health Check Cron Job
 *
 * Runs every 5 minutes
 * Pings the backend to ensure it's responsive
 * Can be extended to check database, external services, etc.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check backend health
    const backendStart = Date.now();
    const backendResponse = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const backendLatency = Date.now() - backendStart;
    const backendHealthy = backendResponse.ok;

    // Check Supabase (optional - can add if needed)
    // const supabaseHealthy = await checkSupabaseHealth();

    const allHealthy = backendHealthy;

    // Log results
    logger.info("Health check cron", {
      backend: backendHealthy ? "healthy" : "unhealthy",
      backendLatency: `${backendLatency}ms`,
      timestamp: new Date().toISOString(),
    });

    // If unhealthy, you could send alerts here
    if (!allHealthy) {
      logger.error("Health check failed! Backend is not responding.");
      // TODO: Send alert to monitoring service (e.g., PagerDuty, Slack)
    }

    return NextResponse.json({
      success: true,
      status: allHealthy ? "healthy" : "unhealthy",
      checks: {
        backend: {
          healthy: backendHealthy,
          latency: backendLatency,
          url: BACKEND_URL,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check cron error", error);
    logger.error("CRITICAL: Health check cron failed to execute!");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
