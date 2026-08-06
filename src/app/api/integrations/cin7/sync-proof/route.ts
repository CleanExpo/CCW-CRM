import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifiable Cin7 nightly sync proof — last N ledger rows + consecutiveCompleteCount >= 3.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 10, 1), 50);

  const rows = await prisma.cin7NightlySyncLedger.findMany({
    where: { ownerUserId: scope.userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });

  const latest = rows[0] ?? null;
  const consecutive = latest?.consecutiveCompleteCount ?? 0;

  return NextResponse.json({
    consecutive_complete_count: consecutive,
    proof_ready: consecutive >= 3,
    required_consecutive: 3,
    ledger: rows.map((row) => ({
      id: row.id,
      started_at: row.startedAt.toISOString(),
      finished_at: row.finishedAt?.toISOString() ?? null,
      overall_status: row.overallStatus,
      consecutive_complete_count: row.consecutiveCompleteCount,
      entity_results: row.entityResults,
    })),
  });
}
