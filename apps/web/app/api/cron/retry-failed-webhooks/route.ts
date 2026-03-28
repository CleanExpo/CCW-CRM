import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Retry Failed Webhooks Cron Job
 *
 * Schedule: Every 5 minutes (*/5 * * * *)
 * ISS-036: Proxies to FastAPI backend to process the webhook retry queue.
 * Retries failed webhooks with exponential backoff, moves to dead letter
 * queue after max retries. Supports Shopify, Xero, SendGrid, Stripe.
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
      `${backendUrl}/api/cron/retry-failed-webhooks`,
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
