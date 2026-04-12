import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Daily Report Cron Job
 *
 * Schedule: Daily at 9:00 AM UTC (0 9 * * *)
 * Generates a daily summary of agent activity including
 * success rates, failures, and execution times.
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
      logger.error('Daily report cron: Missing Supabase credentials');
      return NextResponse.json(
        { success: false, error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    if (error) {
      logger.error('Daily report query error', { error: error.message });
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const totalRuns = runs?.length ?? 0;
    const completedRuns = runs?.filter((r) => r.status === 'completed') ?? [];
    const failedRuns = runs?.filter((r) => r.status === 'failed') ?? [];
    const escalatedRuns = runs?.filter((r) => r.status === 'escalated') ?? [];

    const successRate = totalRuns > 0 ? ((completedRuns.length / totalRuns) * 100).toFixed(1) : '0';

    const executionTimes = completedRuns
      .filter((r) => r.completed_at && r.created_at)
      .map((r) => new Date(r.completed_at).getTime() - new Date(r.created_at).getTime());
    const avgExecutionTime =
      executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0;

    const topFailures = failedRuns.slice(0, 5).map((r) => ({
      id: r.id,
      agent: r.agent_type,
      error: r.error_message?.slice(0, 200),
      created_at: r.created_at,
    }));

    const report = {
      date: yesterday.toISOString().split('T')[0],
      totalRuns,
      completed: completedRuns.length,
      failed: failedRuns.length,
      escalated: escalatedRuns.length,
      successRate: `${successRate}%`,
      avgExecutionTimeMs: avgExecutionTime,
      topFailures,
    };

    logger.info('Daily report generated', report);

    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Daily report cron error', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
