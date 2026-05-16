import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildSendGridStatusPayload, isValidEmailAddress } from '@/lib/integrations/sendgrid-mail';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    api_key?: string;
    from_email?: string;
    from_name?: string;
  };

  const apiKeyFromBody = String(body.api_key ?? '').trim();
  const fromEmailBody = String(body.from_email ?? '').trim();
  const fromNameBody = String(body.from_name ?? '').trim();
  const envKey = process.env.SENDGRID_API_KEY?.trim();
  const existingCookieKey = request.cookies.get('sendgrid_api_key')?.value?.trim();

  if (fromEmailBody && !isValidEmailAddress(fromEmailBody)) {
    return NextResponse.json({ detail: 'from_email is not a valid email address.' }, { status: 400 });
  }

  const mergedApiKey = apiKeyFromBody || existingCookieKey || envKey || null;
  if (!mergedApiKey) {
    return NextResponse.json(
      {
        detail:
          'Provide a SendGrid API key, or set SENDGRID_API_KEY on the server for shared testing.',
      },
      { status: 400 }
    );
  }

  const mergedFromEmail =
    fromEmailBody ||
    request.cookies.get('sendgrid_from_email')?.value?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    null;

  const mergedFromName =
    fromNameBody ||
    request.cookies.get('sendgrid_from_name')?.value?.trim() ||
    process.env.SENDGRID_FROM_NAME?.trim() ||
    null;

  const apiKeySource: 'cookie' | 'environment' =
    Boolean(apiKeyFromBody || existingCookieKey) ? 'cookie' : 'environment';

  const secure = process.env.NODE_ENV === 'production';
  const common = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };

  const payload = await buildSendGridStatusPayload(request, {
    apiKey: mergedApiKey,
    fromEmail: mergedFromEmail,
    fromName: mergedFromName,
    apiKeySource: mergedApiKey ? apiKeySource : null,
  });

  const res = NextResponse.json(payload);
  if (apiKeyFromBody) {
    res.cookies.set('sendgrid_api_key', apiKeyFromBody, common);
  }
  if (fromEmailBody) {
    res.cookies.set('sendgrid_from_email', fromEmailBody, common);
  }
  if (fromNameBody) {
    res.cookies.set('sendgrid_from_name', fromNameBody, common);
  }
  return res;
}
