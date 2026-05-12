import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const sent = await workshop.sendPendingWorkshopReminders(workspaceUserIds);
    return NextResponse.json({
      sent_count: sent,
      message:
        sent > 0
          ? `Marked ${sent} reminder(s) as sent (email delivery is not wired in this build).`
          : 'No due pending reminders to send.',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
