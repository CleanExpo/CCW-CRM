import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const centre = new URL(request.url).searchParams.get('centre')?.trim() || undefined;
    const items = await workshop.listRecallQueue(workspaceUserIds, centre);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
