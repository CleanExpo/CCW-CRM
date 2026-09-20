import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';
import type { RecallReviewStatus } from '@/lib/db/workshop-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { equipmentId } = await context.params;
    const body = await request.json();
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await workshop.reviewRecallCase(
      workspaceUserIds,
      equipmentId,
      { status: body.status as RecallReviewStatus, notes: body.notes },
      scope.userId
    );
    if (!row) return NextResponse.json({ detail: 'Recall case not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
