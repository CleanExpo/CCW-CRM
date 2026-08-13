import { requireAuthScope } from '@/lib/auth/data-scope';
import { b1ResidualsToCsv, listClosedB1Residuals } from '@/lib/integrations/cin7-recon-residuals';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

/**
 * Closed residual (B1) from the last complete acceptance snapshot.
 * Does not re-walk live Cin7. Stock is excluded.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const report = await listClosedB1Residuals(scope.userId);
  const format = request.nextUrl.searchParams.get('format')?.toLowerCase();

  if (format === 'csv') {
    const csv = b1ResidualsToCsv(report.items);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="cin7-b1-closed-residuals.csv"',
      },
    });
  }

  return NextResponse.json(report);
}
