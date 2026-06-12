import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { subscribeWorkspace } from '@/lib/billing/workspace-billing';
import type { SubscribeRequest } from '@/lib/api/billing';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const body = (await request.json()) as SubscribeRequest;
  const subscription = await subscribeWorkspace(workspaceId, body);
  return NextResponse.json(subscription);
}
