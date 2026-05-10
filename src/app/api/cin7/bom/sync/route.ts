import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { syncBomsForOwner } from '@/lib/cin7/bom-memory-store';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { count } = syncBomsForOwner(scope.userId);
  return NextResponse.json({
    status: 'ok',
    boms_synced: count,
    message: `Synced ${count} BOM master(s) into the local Cin7 BOM cache.`,
  });
}
