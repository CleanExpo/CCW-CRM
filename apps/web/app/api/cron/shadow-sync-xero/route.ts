import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { BACKEND_URL } from '@/lib/api/backend-url';

/**
 * Shadow Sync Xero Cron Job
 *
 * Schedule: Daily at 8:00 AM AEST / 20:00 UTC (0 20 * * *)
 * Proxies to FastAPI backend to pull invoices, payments, and accounts
 * from Xero for financial flow observation and readiness scoring.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/api/cron/shadow-sync-xero`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();

    logger.info('Shadow sync Xero cron', {
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
    logger.error('Shadow sync Xero cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
