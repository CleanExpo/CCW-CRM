import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * Autonomous Ops Cron Job
 *
 * Schedule: Every hour (0 * * * *)
 * Proxies to FastAPI backend where Claude Sonnet 4.6 reviews ERP state
 * and creates draft POs, sends payment reminders, flags unmatched
 * transactions, and escalates SLA breaches.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/api/cron/run-autonomous-ops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info('Autonomous ops cron', {
      status: data.status,
      runId: data.run_id,
      actionsTaken: data.actions_taken,
      timestamp: new Date().toISOString(),
    });

    if (data.status === 'error') {
      logger.error('Autonomous ops failed', { error: data.error });
    }

    return NextResponse.json({
      success: response.ok && data.status !== 'error',
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Autonomous ops cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
