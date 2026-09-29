import { requireAuthScope } from '@/lib/auth/data-scope';
import { capturePhase2AsOf } from '@/lib/phase2/as-of';
import { parsePhase2Area, persistPhase2Snapshot, runPhase2Area } from '@/lib/phase2/run';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  if (request.nextUrl.searchParams.get('capture') === 'as-of') {
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

  const area = parsePhase2Area(request.nextUrl.searchParams.get('area'));
  if (!area) {
    return NextResponse.json({ detail: 'area must be 1–8' }, { status: 400 });
  }

  try {
    const report = await runPhase2Area(scope.userId, area);
    const recon_run_id = await persistPhase2Snapshot({
      ownerUserId: scope.userId,
      report,
    });
    return NextResponse.json({ ...report, recon_run_id });
  } catch {
    return NextResponse.json(
      { detail: 'Phase 2 compare failed closed. Cin7 was not treated as clean.', clean: false },
      { status: 503 }
    );
  }
}
