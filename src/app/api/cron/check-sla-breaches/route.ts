import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkSlaBreaches } from '@/lib/workflows/workflow-engine';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'CRON_INTEGRATION_USER_ID not set' },
        { status: 503 }
      );
    }

    const result = await checkSlaBreaches(userId);

    logger.info('Check SLA breaches cron', {
      ...result,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Check SLA breaches cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
