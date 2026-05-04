import { NextRequest, NextResponse } from 'next/server';
import {
  getSendGridCredentialSource,
  verifySendGridApiKey,
} from '@/lib/integrations/sendgrid-mail';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    api_key?: string;
    from_email?: string;
    from_name?: string;
    use_environment_api_key?: boolean;
  };

  const bodyKey = String(body.api_key ?? '').trim();
  const useEnvKey = Boolean(body.use_environment_api_key);
  const envKey = process.env.SENDGRID_API_KEY?.trim() || '';
  const sessionKey = request.cookies.get('sendgrid_api_key')?.value?.trim() || '';

  if (useEnvKey && !envKey) {
    return NextResponse.json(
      { detail: 'SENDGRID_API_KEY is not set on the server; cannot switch to environment key.' },
      { status: 400 }
    );
  }

  if (!bodyKey && !useEnvKey && !sessionKey && !envKey) {
    return NextResponse.json(
      { detail: 'api_key is required unless SENDGRID_API_KEY is already configured on the server.' },
      { status: 400 }
    );
  }

  const secure = process.env.NODE_ENV === 'production';
  const common = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };

  let credential_source = getSendGridCredentialSource(request);
  if (useEnvKey) {
    credential_source = 'environment';
  } else if (bodyKey) {
    credential_source = 'session';
  }

  const response = NextResponse.json({
    connected: true,
    mode: process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live',
    credential_source,
    from_email: body.from_email?.trim() || process.env.SENDGRID_FROM_EMAIL || null,
    from_name: body.from_name?.trim() || process.env.SENDGRID_FROM_NAME || null,
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
    message: 'Settings saved.',
  });

  if (useEnvKey) {
    response.cookies.set('sendgrid_api_key', '', { path: '/', maxAge: 0 });
  } else if (bodyKey) {
    const liveOk = process.env.SENDGRID_MODE !== 'demo' ? await verifySendGridApiKey(bodyKey) : true;
    if (!liveOk) {
      return NextResponse.json({ detail: 'SendGrid rejected this API key.' }, { status: 401 });
    }
    response.cookies.set('sendgrid_api_key', bodyKey, common);
  }

  if (body.from_email?.trim()) {
    response.cookies.set('sendgrid_from_email', body.from_email.trim(), common);
  }
  if (body.from_name?.trim()) {
    response.cookies.set('sendgrid_from_name', body.from_name.trim(), common);
  }

  return response;
}
