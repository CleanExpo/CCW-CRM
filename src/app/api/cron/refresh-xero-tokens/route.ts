import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { refreshAllWorkspaceXeroTokens } from '@/lib/integrations/xero-refresh-all';
import { cronAuthFailure } from '@/lib/api/cron-auth';

/**
 * Refresh expiring Xero tokens for all workspace connections.
 * Schedule: every 15 minutes — Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = cronAuthFailure(request);
    if (unauthorized) return unauthorized;

    const data = await refreshAllWorkspaceXeroTokens();

    logger.info('Refresh Xero tokens cron', {
      refreshed: data.refreshed,
      skipped: data.skipped,
      errors: data.errors.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Refresh Xero tokens cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
