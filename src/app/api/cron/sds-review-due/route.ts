import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireUpstreamBase } from '@/lib/api/upstream-proxy';
import { cronAuthFailure } from '@/lib/api/cron-auth';

// SDS Review-Due Cron Job
// Schedule: Daily at 8:00 AM AEST / 22:00 UTC (0 22 * * *)
// Flags SDS records whose reviewDueDate < NOW() + 30 days.
// Forwards to `API_UPSTREAM_URL` when configured.

export async function GET(request: Request) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const base = requireUpstreamBase('SDS review-due');
    if (base instanceof NextResponse) return base;

    const response = await fetch(`${base}/api/cron/sds-review-due`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info('SDS review-due cron', {
      flagged: data.flagged,
      notificationsSent: data.notifications_sent,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: response.ok,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('SDS review-due cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
