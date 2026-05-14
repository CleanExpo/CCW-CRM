import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { gapsSummaryForUser } from '@/lib/integrations/cin7-shadow-sync-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(gapsSummaryForUser(scope.userId));
}
