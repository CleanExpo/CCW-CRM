import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { listBomsForWorkspace } from '@/lib/db/cin7-bom-service';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
  const status = searchParams.get('status')?.trim() || undefined;

  try {
    const payload = await listBomsForWorkspace(workspaceUserIds, page, pageSize, status);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|no such table|relation.*cin7/i.test(msg)) {
      return NextResponse.json(
        {
          items: [],
          total: 0,
          page: 1,
          page_size: pageSize,
          total_pages: 1,
          detail: 'Run prisma migrate deploy to enable cin7_bom_* tables.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
