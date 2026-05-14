import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { deleteSubscription, updateSubscription } from '@/lib/integrations/cin7-webhook-subscriptions-store';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await context.params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { is_active?: boolean; endpoint_url?: string; secret_key?: string };
  const updated = updateSubscription(scope.userId, id, body);
  if (!updated) {
    return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await context.params;
  const ok = deleteSubscription(scope.userId, id);
  if (!ok) {
    return NextResponse.json({ detail: 'Subscription not found' }, { status: 404 });
  }
  return NextResponse.json({ status: 'deleted', id });
}
