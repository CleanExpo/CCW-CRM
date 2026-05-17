import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  getXeroClientId,
  getXeroMode,
  hasLiveClientCredentials,
  listXeroRegisteredRedirectUris,
  resolveXeroRedirectUri,
} from '@/lib/integrations/xero';

/** Operator diagnostics for Xero OAuth (safe to expose to authenticated admins). */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const clientId = getXeroClientId();
  const redirectForRequest = resolveXeroRedirectUri(request);
  const registered = listXeroRegisteredRedirectUris();

  return NextResponse.json({
    mode: getXeroMode(),
    credentials_configured: hasLiveClientCredentials(),
    client_id_prefix: clientId ? `${clientId.slice(0, 8)}…` : null,
    request_origin: request.nextUrl.origin,
    oauth_redirect_uri_for_request: redirectForRequest,
    registered_redirect_uris: registered,
    developer_portal_url: 'https://developer.xero.com/app/manage',
    authorize_url_hint: '/api/integrations/xero/auth',
    callback_path: '/api/integrations/xero/callback',
    notes: [
      'Every Redirect URI you use must be listed under your Xero app → Configuration → Redirect URIs.',
      'Local dev: open the app at http://localhost:3000 and register that exact callback URL.',
      'Production: register https://ccwonline.com.au/api/integrations/xero/callback (and www. if used).',
    ],
  });
}
