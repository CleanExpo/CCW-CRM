import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { sendDunningLetter } from '@/lib/billing/workspace-billing';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { invoice_id?: string };
  const result = await sendDunningLetter(workspaceId, body.invoice_id);
  return NextResponse.json(result);
}
