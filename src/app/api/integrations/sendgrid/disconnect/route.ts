import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { resolveSendGridCredentials } from '@/lib/integrations/sendgrid-config';
import { buildSendGridStatusPayload } from '@/lib/integrations/sendgrid-mail';

/** Clears SendGrid httpOnly cookies so the app falls back to server environment variables. */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const creds = await resolveSendGridCredentials(request, scope.userId);

  const payload = await buildSendGridStatusPayload(
    request,
    {
      apiKey: creds.apiKey,
      fromEmail: creds.fromEmail,
      fromName: creds.fromName,
      apiKeySource: creds.source,
      creds,
    },
    scope.userId
  );

  const res = NextResponse.json(payload);
  const clearOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
  for (const name of ['sendgrid_api_key', 'sendgrid_from_email', 'sendgrid_from_name'] as const) {
    res.cookies.set(name, '', clearOpts);
  }
  return res;
}
