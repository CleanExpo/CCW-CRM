import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  cancelWorkspaceSubscription,
  getWorkspaceSubscription,
  updateWorkspaceSubscription,
} from '@/lib/billing/workspace-billing';
import type { UpdateSubscriptionRequest } from '@/lib/api/billing';

async function resolveWorkspace(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return null;
  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return null;
  return { scope, workspaceId };
}

export async function GET(request: NextRequest) {
  const ctx = await resolveWorkspace(request);
  if (!ctx) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const subscription = await getWorkspaceSubscription(ctx.workspaceId);
  return NextResponse.json(subscription);
}

export async function PUT(request: NextRequest) {
  const ctx = await resolveWorkspace(request);
  if (!ctx) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const body = (await request.json()) as UpdateSubscriptionRequest;
  const subscription = await updateWorkspaceSubscription(ctx.workspaceId, body);
  return NextResponse.json(subscription);
}

export async function DELETE(request: NextRequest) {
  const ctx = await resolveWorkspace(request);
  if (!ctx) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const immediately = new URL(request.url).searchParams.get('immediately') === 'true';
  await cancelWorkspaceSubscription(ctx.workspaceId, immediately);
  return NextResponse.json({ ok: true });
}
