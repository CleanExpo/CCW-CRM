import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parsePagination } from '@/lib/workshop/pagination';
import * as workshop from '@/lib/db/workshop-service';
import type { EquipmentCreate } from '@/lib/api/workshop-types';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePagination(searchParams);
    const customerId = searchParams.get('customer_id')?.trim() || undefined;
    const location = searchParams.get('location')?.trim() || undefined;
    const status = searchParams.get('status')?.trim() || undefined;
    const overdueOnly = searchParams.get('overdue_only') === 'true';
    const search = searchParams.get('search')?.trim() || undefined;

    const data = await workshop.listWorkshopEquipment(workspaceUserIds, {
      page,
      pageSize,
      customerId,
      location,
      status,
      overdueOnly,
      search,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const body = (await request.json()) as EquipmentCreate;
    const row = await workshop.createWorkshopEquipment(workspaceUserIds, scope.userId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes('not found') ? 400 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
