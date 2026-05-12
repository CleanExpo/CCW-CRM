import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parsePagination } from '@/lib/workshop/pagination';
import * as workshop from '@/lib/db/workshop-service';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePagination(searchParams);
    const make = searchParams.get('make')?.trim() || undefined;
    const serviceType = searchParams.get('service_type')?.trim() || undefined;
    const rawActive = searchParams.get('is_active');
    const isActive =
      rawActive === 'true' ? true : rawActive === 'false' ? false : undefined;

    const data = await workshop.listWorkshopTemplates(workspaceUserIds, {
      page,
      pageSize,
      make,
      serviceType,
      isActive,
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
    const body = (await request.json()) as Record<string, unknown>;
    const row = await workshop.createWorkshopTemplate(workspaceUserIds, scope.userId, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = String(e);
    const status = msg.includes('not found') || msg.includes('required') ? 400 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
