import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { evidenceCsv } from '@/lib/phase2/evidence';
import { parsePhase2Area } from '@/lib/phase2/run';
import type { Phase2AreaReport } from '@/lib/phase2/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  if (scope.role === 'member') {
    return NextResponse.json(
      { detail: 'Your role does not have access to this resource' },
      { status: 403 }
    );
  }
  const area = parsePhase2Area(request.nextUrl.searchParams.get('area'));
  if (!area) {
    return NextResponse.json({ detail: 'area must be 1–8' }, { status: 400 });
  }
  const row = await prisma.cin7ReconRun.findFirst({
    where: { ownerUserId: scope.userId, mode: `phase2_area_${area}` },
    orderBy: { checkedAt: 'desc' },
    select: { summary: true },
  });
  if (!row?.summary || typeof row.summary !== 'object') {
    return NextResponse.json({ detail: 'Run a compare first.' }, { status: 404 });
  }
  const csv = evidenceCsv(row.summary as unknown as Phase2AreaReport);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="phase2-area-${area}.csv"`,
    },
  });
}
