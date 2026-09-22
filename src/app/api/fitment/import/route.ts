import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { importFitments } from '@/lib/fitment/fitment-service';
import { parseFitmentCsv } from '@/lib/fitment/rules';

const MAX_CSV_BYTES = 2_000_000;

/** Bulk import from the spreadsheet Toby's team fills in. Body: { csv, confirm? }. */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const body = await request.json();
    const csv = typeof body.csv === 'string' ? body.csv : '';
    if (!csv) return NextResponse.json({ detail: 'csv is required' }, { status: 400 });
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ detail: 'File is too large' }, { status: 413 });
    }
    const parsed = parseFitmentCsv(csv);
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const res = await importFitments(ids, scope.userId, parsed.rows, {
      confirm: body.confirm === true,
    });
    const errors = [...parsed.errors, ...res.errors].sort((a, b) => a.line - b.line);
    return NextResponse.json({ imported: res.imported, errors });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
