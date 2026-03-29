/**
 * CCW Boardroom — Vercel CRON Endpoint (UNI-1669)
 *
 * Triggered 4× daily: AEST 6am / 12pm / 6pm / midnight
 * UTC schedule: 20:00 / 02:00 / 08:00 / 14:00
 *
 * Validates CRON_SECRET, then fires the boardroom orchestrator
 * on the backend (or directly via the SDK if running serverless).
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // ── Auth: Vercel sends Authorization: Bearer <CRON_SECRET> ──
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sessionStart = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[Boardroom CRON] Session triggered at ${timestamp}`);

  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    // Kick off the boardroom session on the backend.
    // Backend runs the full 18-step orchestrator and returns the debrief JSON.
    const response = await fetch(`${backendUrl}/api/boardroom/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        "X-CCW-Session-Source": "vercel-cron",
        "X-CCW-Timestamp": timestamp,
      },
      // Vercel function timeout is 300s max — boardroom sessions typically 60–120s
      signal: AbortSignal.timeout(280_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Boardroom CRON] Backend error ${response.status}: ${errorText}`);
      return NextResponse.json(
        {
          success: false,
          error: `Backend responded with ${response.status}`,
          timestamp,
        },
        { status: 502 }
      );
    }

    const debrief = await response.json();
    const duration = Date.now() - sessionStart;

    console.log(
      `[Boardroom CRON] Session ${debrief.sessionId} complete — ` +
        `BUILD_STATUS: ${debrief.buildStatus} — ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      sessionId: debrief.sessionId,
      buildStatus: debrief.buildStatus,
      youtubeVideoId: debrief.youtubeVideoId ?? null,
      durationMs: duration,
      timestamp,
    });
  } catch (error) {
    const duration = Date.now() - sessionStart;
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error(`[Boardroom CRON] Session failed after ${duration}ms:`, message);

    // Alert CEO via Slack if configured
    await notifyCEO(message, timestamp);

    return NextResponse.json(
      {
        success: false,
        error: message,
        durationMs: duration,
        timestamp,
      },
      { status: 500 }
    );
  }
}

/**
 * Send failure notification to CEO via Slack webhook.
 * No-op if SLACK_WEBHOOK_URL is not configured.
 */
async function notifyCEO(errorMessage: string, timestamp: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *CCW Boardroom CRON Failed*\n*Time:* ${timestamp}\n*Error:* ${errorMessage}`,
      }),
    });
  } catch {
    // Slack notification failure is non-fatal
  }
}
