import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { createRunForOwner, listRunsForOwner } from '@/lib/cin7/bom-memory-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
  const status = searchParams.get('status')?.trim() || undefined;

  const payload = listRunsForOwner(scope.userId, page, pageSize, status);
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

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

  const run = createRunForOwner(scope.userId, {
    bom_master_id,
    quantity_planned,
    planned_date: body.planned_date != null ? String(body.planned_date) : null,
    location_id: body.location_id != null ? String(body.location_id) : null,
    notes: body.notes != null ? String(body.notes) : null,
  });

  if (!run) {
    return NextResponse.json(
      { detail: 'BOM master not found. Run POST /api/cin7/bom/sync first.' },
      { status: 404 },
    );
  }

  return NextResponse.json(run, { status: 201 });
}
