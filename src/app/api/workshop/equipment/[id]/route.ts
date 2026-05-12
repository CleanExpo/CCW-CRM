import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as workshop from '@/lib/db/workshop-service';
import type { EquipmentCreate, EquipmentStatus } from '@/lib/api/workshop-types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const detail = await workshop.getWorkshopEquipmentById(workspaceUserIds, id);
    if (!detail) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const body = (await request.json()) as Partial<EquipmentCreate> & { status?: EquipmentStatus };
    const row = await workshop.updateWorkshopEquipment(workspaceUserIds, id, body);
    if (!row) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    const msg = String(e);
    const status = msg.includes('not found') ? 400 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const ok = await workshop.retireWorkshopEquipment(workspaceUserIds, id);
    if (!ok) return NextResponse.json({ detail: 'Equipment not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
