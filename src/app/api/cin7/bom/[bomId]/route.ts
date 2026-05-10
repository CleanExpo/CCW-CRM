import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getBomForOwner } from '@/lib/cin7/bom-memory-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bomId: string }> },
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { bomId } = await context.params;
  const bom = getBomForOwner(scope.userId, bomId);
  if (!bom) {
    return NextResponse.json({ detail: 'BOM not found' }, { status: 404 });
  }
  return NextResponse.json(bom);
}
