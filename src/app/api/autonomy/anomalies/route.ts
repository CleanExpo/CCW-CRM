import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

function parseWindowHours(request: NextRequest, fallback = 24): number {
  const raw = Number(request.nextUrl.searchParams.get('window_hours') || fallback);
  return Number.isFinite(raw) ? Math.max(1, Math.min(24 * 30, raw)) : fallback;
}

function bucketByHour(ts: Date): string {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const windowHours = parseWindowHours(request, 24);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const runs = await prisma.agentRun.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, errorMessage: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const anomalies: string[] = [];

    const failures = runs.filter((r: { status: string; errorMessage: string | null; createdAt: Date }) => r.status === 'failed' || r.status === 'blocked' || r.status === 'rejected');
    const failureRate = runs.length > 0 ? failures.length / runs.length : 0;
    if (runs.length >= 5 && failureRate > 0.3) {
      anomalies.push(`High failure ratio: ${(failureRate * 100).toFixed(1)}% in last ${windowHours}h.`);
    }

    const errorText = failures.map((r: { status: string; errorMessage: string | null; createdAt: Date }) => (r.errorMessage || '').toLowerCase());
    const rateLimitHits = errorText.filter((m: string) => m.includes('rate limit')).length;
    if (rateLimitHits > 0) {
      anomalies.push(`Rate limit detected ${rateLimitHits} time(s).`);
    }

    const hourlyCounts = new Map<string, number>();
    for (const r of failures) {
      const bucket = bucketByHour(new Date(r.createdAt));
      hourlyCounts.set(bucket, (hourlyCounts.get(bucket) || 0) + 1);
    }

    const maxBurst = [...hourlyCounts.values()].reduce((m, v) => Math.max(m, v), 0);
    if (maxBurst >= 5) {
      anomalies.push(`Failure burst detected: ${maxBurst} failures in a single hour.`);
    }

    return NextResponse.json({
      window_hours: windowHours,
      anomalies,
      has_anomalies: anomalies.length > 0,
      anomaly_count: anomalies.length,
    });
  } catch (error) {
    logger.error('Failed to build autonomy anomalies', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to fetch autonomy anomalies' },
      { status: 500 }
    );
  }
}
