import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { patchRunStatusForOwner } from '@/lib/cin7/bom-memory-store';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const status = String(body.status ?? '').trim();
  if (!status) {
    return NextResponse.json({ detail: 'status is required' }, { status: 400 });
  }

  let quantity_completed: number | undefined;
  if (body.quantity_completed != null && body.quantity_completed !== '') {
    const q = Number(body.quantity_completed);
    if (Number.isFinite(q)) quantity_completed = q;
  }
  const completed_date =
    body.completed_date != null ? String(body.completed_date) : undefined;
  const notes = body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined;

  const run = patchRunStatusForOwner(scope.userId, id, {
    status,
    quantity_completed,
    completed_date: completed_date ?? undefined,
    notes,
  });

  if (!run) {
    return NextResponse.json({ detail: 'Production run not found' }, { status: 404 });
  }

  return NextResponse.json(run);
}
