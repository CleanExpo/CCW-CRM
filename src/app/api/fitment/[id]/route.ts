import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import * as fitment from '@/lib/fitment/fitment-service';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const body = await request.json();
    const row = await fitment.reviewFitment(ids, scope.userId, id, {
      status: body.status,
      kind: body.kind,
      usageQuantity: body.usage_quantity === undefined ? undefined : body.usage_quantity === null ? null : Number(body.usage_quantity),
      usagePer: body.usage_per,
    });
    if (!row) return NextResponse.json({ detail: 'Fitment not found' }, { status: 404 });
    return NextResponse.json(fitment.fitmentToApi(row));
  } catch (e) {
    if (e instanceof fitment.FitmentInputError) {
      return NextResponse.json({ detail: e.message }, { status: 400 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const ids = await getWorkspaceMemberUserIds(scope.userId);
    const ok = await fitment.deleteFitment(ids, id);
    if (!ok) return NextResponse.json({ detail: 'Fitment not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
