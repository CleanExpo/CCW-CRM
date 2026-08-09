import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  getImmutableReconSnapshot,
  listImmutableReconSnapshots,
} from '@/lib/integrations/cin7-recon-snapshot-store';
import { NextRequest, NextResponse } from 'next/server';

/** List or fetch immutable reconciliation snapshots for this Optix account (B5). */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (id) {
    const snapshot = await getImmutableReconSnapshot(scope.userId, id);
    if (!snapshot) {
      return NextResponse.json({ detail: 'Snapshot not found for this account' }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
  const items = await listImmutableReconSnapshots(scope.userId, limit);
  return NextResponse.json({
    owner_user_id: scope.userId,
    note: 'Cin7 sync and reconciliation are scoped per Optix account (owner). Two logins on the same URL can show different ledgers and snapshots.',
    items,
  });
}
