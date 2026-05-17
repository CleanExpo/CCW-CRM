import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { clearXeroSessionCookies } from '@/lib/integrations/xero-oauth';
import { clearWorkspaceXeroConnection } from '@/lib/integrations/xero-storage';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (workspaceId) {
    await clearWorkspaceXeroConnection(workspaceId);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Xero disconnected successfully.',
  });
  clearXeroSessionCookies(response);
  return response;
}
