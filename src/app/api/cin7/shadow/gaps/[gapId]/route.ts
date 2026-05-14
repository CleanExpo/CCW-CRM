import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, jsonDetail } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { patchGap } from '@/lib/integrations/cin7-shadow-sync-store';
import type { Cin7SyncGap } from '@/lib/api/cin7-shadow';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ gapId: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { gapId } = await context.params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as Partial<Pick<Cin7SyncGap, 'status' | 'resolution_notes'>>;
  const status = body.status;
  if (status !== 'open' && status !== 'investigating' && status !== 'resolved' && status !== 'ignored') {
    return jsonDetail('Invalid status', 400);
  }
  const notes =
    body.resolution_notes === undefined || body.resolution_notes === null
      ? undefined
      : body.resolution_notes;
  const updated = patchGap(scope.userId, gapId, status, notes);
  if (!updated) {
    return NextResponse.json({ detail: 'Gap not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}
