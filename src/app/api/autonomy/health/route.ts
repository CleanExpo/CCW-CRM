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

export async function GET(request: NextRequest) {
  try {
    const windowHours = parseWindowHours(request, 24);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const runs = await prisma.agentRun.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, errorMessage: true },
    });

    const total = runs.length;
    const completed = runs.filter((r: { status: string; errorMessage: string | null }) => r.status === 'completed').length;
    const failed = runs.filter((r: { status: string; errorMessage: string | null }) => r.status === 'failed').length;
    const blocked = runs.filter((r: { status: string; errorMessage: string | null }) => r.status === 'blocked').length;
    const rejected = runs.filter((r: { status: string; errorMessage: string | null }) => r.status === 'rejected').length;

    const successRate = safeRate(completed, total);
    const errorRate = safeRate(failed + blocked + rejected, total);
    const testPassRate = safeRate(completed, completed + failed);

    const issues: string[] = [];
    if (total === 0) {
      issues.push('No agent runs in selected window.');
    }
    if (errorRate >= 0.2) {
      issues.push(`High error rate detected (${(errorRate * 100).toFixed(1)}%).`);
    }
    if (blocked > 0) {
      issues.push(`${blocked} run(s) blocked by policy checks.`);
    }
    if (runs.some((r: { status: string; errorMessage: string | null }) => (r.errorMessage || '').toLowerCase().includes('rate limit'))) {
      issues.push('Rate limit events detected in run logs.');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate >= 0.35 || successRate < 0.5) {
      status = 'unhealthy';
    } else if (errorRate >= 0.15 || successRate < 0.75) {
      status = 'degraded';
    }

    return NextResponse.json({
      status,
      metrics: {
        success_rate: successRate,
        error_rate: errorRate,
        test_pass_rate: testPassRate,
        total_actions: total,
        total_auto_merged: completed,
      },
      issues,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to build autonomy health', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to fetch autonomy health' },
      { status: 500 }
    );
  }
}
