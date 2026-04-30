import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

function parseWindowHours(request: NextRequest, fallback = 24): number {
  const raw = Number(request.nextUrl.searchParams.get('window_hours') || fallback);
  return Number.isFinite(raw) ? Math.max(1, Math.min(24 * 30, raw)) : fallback;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function inferRisk(agentType?: string | null, errorMessage?: string | null): 'low' | 'medium' | 'high' {
  const t = `${agentType || ''} ${errorMessage || ''}`.toLowerCase();
  if (t.includes('prod') || t.includes('payment') || t.includes('auth') || t.includes('security')) {
    return 'high';
  }
  if (t.includes('db') || t.includes('schema') || t.includes('migration') || t.includes('deploy')) {
    return 'medium';
  }
  return 'low';
}

export async function GET(request: NextRequest) {
  try {
    const windowHours = parseWindowHours(request, 24);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const runs = await prisma.agentRun.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        status: true,
        agentType: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalActions = runs.length;
    const merged = runs.filter((r) => r.status === 'completed').length;
    const rejected = runs.filter((r) => r.status === 'rejected').length;
    const blocked = runs.filter((r) => r.status === 'blocked').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const escalated = runs.filter((r) => r.status === 'escalated').length;

    const durations = runs
      .filter((r) => r.completedAt)
      .map((r) => new Date(r.completedAt as Date).getTime() - new Date(r.createdAt).getTime())
      .filter((ms) => Number.isFinite(ms) && ms >= 0);
    const avgDurationMs =
      durations.length > 0
        ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length
        : 0;

    const riskDistribution = { low: 0, medium: 0, high: 0 };
    for (const run of runs) {
      const risk = inferRisk(run.agentType, run.errorMessage);
      riskDistribution[risk] += 1;
    }

    return NextResponse.json({
      total_actions: totalActions,
      total_prs_created: totalActions,
      total_auto_merged: merged,
      total_rejected: rejected,
      total_blocked: blocked,
      auto_merge_success_rate: safeRate(merged, totalActions),
      test_pass_rate: safeRate(merged, merged + failed + escalated),
      protected_file_violations: blocked,
      rate_limit_hits: runs.filter((r) => (r.errorMessage || '').toLowerCase().includes('rate limit')).length,
      circuit_breaker_trips: runs.filter((r) => (r.errorMessage || '').toLowerCase().includes('circuit')).length,
      auto_merge_reversions: runs.filter((r) => (r.errorMessage || '').toLowerCase().includes('revert')).length,
      risk_distribution: riskDistribution,
      avg_duration_ms: avgDurationMs,
    });
  } catch (error) {
    logger.error('Failed to build autonomy metrics', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to fetch autonomy metrics' },
      { status: 500 }
    );
  }
}
