import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { createRunForWorkspace, listRunsForWorkspace } from '@/lib/db/cin7-bom-service';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
  const status = searchParams.get('status')?.trim() || undefined;

  try {
    const payload = await listRunsForWorkspace(workspaceUserIds, page, pageSize, status);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|no such table|relation.*cin7/i.test(msg)) {
      return NextResponse.json(
        {
          items: [],
          total: 0,
          page: 1,
          page_size: pageSize,
          total_pages: 1,
          detail: 'Run prisma migrate deploy.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const bom_master_id = String(body.bom_master_id ?? '').trim();
  const quantity_planned = Number(body.quantity_planned ?? 0);
  if (!bom_master_id || !Number.isFinite(quantity_planned) || quantity_planned <= 0) {
    return NextResponse.json(
      { detail: 'bom_master_id and positive quantity_planned are required' },
      { status: 400 },
    );
  }

  try {
    const run = await createRunForWorkspace(workspaceUserIds, scope.userId, {
      bom_master_id,
      quantity_planned,
      planned_date: body.planned_date != null ? String(body.planned_date) : null,
      location_id: body.location_id != null ? String(body.location_id) : null,
      notes: body.notes != null ? String(body.notes) : null,
    });

    if (!run) {
      return NextResponse.json(
        { detail: 'BOM master not found. Sync BOMs from the catalog first.' },
        { status: 404 },
      );
    }

    return NextResponse.json(run, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|no such table|relation.*cin7/i.test(msg)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
