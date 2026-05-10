import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { syncBomsFromCatalog } from '@/lib/db/cin7-bom-service';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

  try {
    const count = await syncBomsFromCatalog(workspaceUserIds);
    return NextResponse.json({
      status: 'ok',
      boms_synced: count,
      message:
        count === 0
          ? 'No active products in workspace — add products, then sync again.'
          : `Synced ${count} BOM master(s) from your product catalog.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|no such table|relation.*cin7/i.test(msg)) {
      return NextResponse.json(
        { detail: 'Run prisma migrate deploy to enable cin7_bom_* tables.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
