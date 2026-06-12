import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { removeWorkspacePaymentMethod } from '@/lib/billing/workspace-billing';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const { id } = await context.params;
  await removeWorkspacePaymentMethod(workspaceId, id);
  return NextResponse.json({ ok: true });
}
