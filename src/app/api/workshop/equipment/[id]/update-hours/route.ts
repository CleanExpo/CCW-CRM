import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const body = (await request.json()) as { current_hours?: number };
    const hours = Number(body.current_hours);
    if (!Number.isFinite(hours) || hours < 0) {
      return NextResponse.json({ detail: 'current_hours required' }, { status: 400 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await workshop.updateEquipmentHours(workspaceUserIds, id, Math.floor(hours));
    if (!row) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
