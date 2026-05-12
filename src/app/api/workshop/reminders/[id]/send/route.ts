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
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await workshop.sendWorkshopReminder(workspaceUserIds, id);
    if (!row) return NextResponse.json({ detail: 'Reminder not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
