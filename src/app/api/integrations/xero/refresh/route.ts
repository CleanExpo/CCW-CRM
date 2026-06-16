import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getValidXeroTokens } from '@/lib/integrations/xero-tokens';

/** Manually refresh the current workspace Xero access token. */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const tokens = await getValidXeroTokens(request, scope.userId);
  if (!tokens) {
    return NextResponse.json({ detail: 'Xero is not connected.' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    token_source: tokens.source,
    token_expires_at: tokens.expiresAt?.toISOString() ?? null,
  });
}
