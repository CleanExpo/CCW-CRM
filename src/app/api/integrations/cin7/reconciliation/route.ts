import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildCin7Reconciliation } from '@/lib/integrations/cin7-reconciliation';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const snapshot = await buildCin7Reconciliation(scope.userId);
  return NextResponse.json(snapshot);
}
