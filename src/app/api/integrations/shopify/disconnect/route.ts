import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';

const CLEAR = { path: '/', maxAge: 0 } as const;

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, message: 'Shopify disconnected.' });
  for (const name of [
    'shopify_connected',
    'shopify_shop_domain',
    'shopify_access_token',
    'shopify_api_key',
    'shopify_api_secret',
    'shopify_webhook_secret',
    'shopify_oauth_state',
    'shopify_oauth_shop',
  ]) {
    response.cookies.set(name, '', CLEAR);
  }
  return response;
}
