import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  addWorkspacePaymentMethod,
  listWorkspacePaymentMethods,
} from '@/lib/billing/workspace-billing';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const methods = await listWorkspacePaymentMethods(workspaceId);
  return NextResponse.json(methods);
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const body = (await request.json()) as { payment_method_id?: string };
  if (!body.payment_method_id) {
    return NextResponse.json({ detail: 'payment_method_id is required' }, { status: 400 });
  }

  const method = await addWorkspacePaymentMethod(workspaceId, body.payment_method_id);
  return NextResponse.json(method);
}
