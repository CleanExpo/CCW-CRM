import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';
import { WorkshopOutreachBlockedError } from '@/lib/workshop/customer-outreach-gate';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    await workshop.sendWorkshopReminder(workspaceUserIds, id);
    return NextResponse.json({ sent: false });
  } catch (e) {
    if (e instanceof WorkshopOutreachBlockedError) {
      return NextResponse.json({ detail: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
