import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, jsonDetail } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  createSubscription,
  listSubscriptions,
} from '@/lib/integrations/cin7-webhook-subscriptions-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const raw = request.nextUrl.searchParams.get('is_active');
  const isActive = raw === 'true' ? true : raw === 'false' ? false : undefined;
  return NextResponse.json(listSubscriptions(scope.userId, isActive));
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { event_type?: string; endpoint_url?: string; secret_key?: string };
  if (!body.event_type?.trim() || !body.endpoint_url?.trim()) {
    return jsonDetail('event_type and endpoint_url are required', 422);
  }
  const row = createSubscription(scope.userId, {
    event_type: body.event_type.trim(),
    endpoint_url: body.endpoint_url.trim(),
    secret_key: body.secret_key,
  });
  return NextResponse.json(row, { status: 201 });
}
