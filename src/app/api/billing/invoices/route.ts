import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { listWorkspaceBillingInvoices } from '@/lib/billing/workspace-billing';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 });

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') ?? 10), 50);
  const invoices = await listWorkspaceBillingInvoices(workspaceId, limit);
  return NextResponse.json(invoices);
}
