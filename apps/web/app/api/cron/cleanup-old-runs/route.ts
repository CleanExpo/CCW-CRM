import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Cleanup Old Runs Cron Job
 *
 * Schedule: Daily at 2:00 AM UTC (0 2 * * *)
 * Deletes completed/failed agent runs older than 30 days
 * to keep the database lean and performant.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Cleanup cron: Missing Supabase credentials');
      return NextResponse.json(
        { success: false, error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('agent_runs')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', thirtyDaysAgo.toISOString())
      .select('id');

    if (error) {
      logger.error('Cleanup cron error', { error: error.message });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const deletedCount = data?.length ?? 0;

    logger.info('Cleanup old runs cron', {
      deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      cutoffDate: thirtyDaysAgo.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cleanup old runs cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
