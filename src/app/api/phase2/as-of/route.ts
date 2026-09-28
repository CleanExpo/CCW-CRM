import { requireAuthScope } from '@/lib/auth/data-scope';
import { attachAnneToPhase2AsOf, capturePhase2AsOf, loadLatestPhase2AsOf } from '@/lib/phase2/as-of';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  const row = await loadLatestPhase2AsOf(scope.userId);
  if (!row) return NextResponse.json({ detail: 'No Part 1.3 as-of snapshot yet.' }, { status: 404 });
  return NextResponse.json(row);
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  try {
    const captured = await capturePhase2AsOf(scope.userId);
    return NextResponse.json({
      ...captured,
      instruction:
        'Walk must finish before 10:55 AEST. Do not prune, sync or change stock until Anne’s 11:00 export is attached to this ID.',
    });
  } catch {
    return NextResponse.json({ detail: 'Could not capture Optix as-of.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    snapshotId?: string;
    runTimestamp?: string;
    qtyTotal?: number;
    value?: number | null;
  } | null;
  if (!body?.snapshotId || !body.runTimestamp || typeof body.qtyTotal !== 'number') {
    return NextResponse.json(
      { detail: 'snapshotId, runTimestamp and qtyTotal are required.' },
      { status: 400 }
    );
  }
  try {
    const summary = await attachAnneToPhase2AsOf({
      ownerUserId: scope.userId,
      snapshotId: body.snapshotId,
      runTimestamp: body.runTimestamp,
      qtyTotal: body.qtyTotal,
      value: body.value,
    });
    return NextResponse.json({ id: body.snapshotId, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Attach failed';
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
