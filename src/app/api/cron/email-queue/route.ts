/**
 * GET /api/cron/email-queue
 *
 * Drains due retries from the transactional outbound queue (UNI-2671 A3).
 * Auth: Bearer ${CRON_SECRET} — the same pattern as every other cron route here.
 *
 * Suggested schedule: every 5 minutes. The backoff ladder is 1, 5, 15, 60 and
 * 240 minutes, so a slower tick simply delays retries; it does not lose them.
 *
 * A run that could not happen returns `skipped` with the reason. Zero counts and
 * "the queue is switched off" are different facts and this endpoint reports them
 * as different facts, because a monitor that cannot tell them apart will read a
 * dead queue as a quiet one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cronAuthFailure } from '@/lib/api/cron-auth';
import { runEmailQueue } from '@/lib/email/mailer';

export async function GET(request: NextRequest) {
  const unauthorized = cronAuthFailure(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await runEmailQueue();
    return NextResponse.json({
      ok: true,
      ran: summary.skipped === undefined,
      ...summary,
    });
  } catch (error) {
    console.error('[cron/email-queue]', error);
    return NextResponse.json(
      {
        ok: false,
        ran: false,
        detail: error instanceof Error ? error.message : 'email queue run failed',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
