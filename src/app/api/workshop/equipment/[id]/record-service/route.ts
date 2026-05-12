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
    const body = (await request.json()) as {
      service_date: string;
      service_type: string;
      technician?: string;
      hours_at_service?: number;
      notes?: string;
    };
    if (!body.service_date || !body.service_type) {
      return NextResponse.json({ detail: 'service_date and service_type required' }, { status: 400 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await workshop.recordEquipmentService(workspaceUserIds, id, body);
    if (!row) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
