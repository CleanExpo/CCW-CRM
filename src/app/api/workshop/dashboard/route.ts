import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getWorkshopDashboard } from '@/lib/db/workshop-service';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const location = new URL(request.url).searchParams.get('location')?.trim() || 'all';
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const data = await getWorkshopDashboard(workspaceUserIds, location);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
