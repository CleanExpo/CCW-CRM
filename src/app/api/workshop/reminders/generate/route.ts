import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const created = await workshop.generateWorkshopReminders(workspaceUserIds);
    return NextResponse.json({
      reminders_created: created,
      message:
        created > 0
          ? `Created ${created} reminder(s) from equipment service schedules.`
          : 'No new reminders to create (existing pending reminders or no scheduled services).',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
