import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getBomForWorkspace } from '@/lib/db/cin7-bom-service';

/**
 * GET /api/cin7/bom/master/:bomId
 * Uses a static "master" segment so /api/cin7/bom/production-runs is not captured by a dynamic [bomId] route.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ bomId: string }> },
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const { bomId } = await context.params;

  try {
    const bom = await getBomForWorkspace(workspaceUserIds, bomId);
    if (!bom) {
      return NextResponse.json({ detail: 'BOM not found' }, { status: 404 });
    }
    return NextResponse.json(bom);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|no such table|relation.*cin7/i.test(msg)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
