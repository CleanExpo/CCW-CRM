import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    core_account_id?: string;
    core_application_key?: string;
    omni_username?: string;
    omni_api_key?: string;
  };

  const coreAccountId = String(body.core_account_id ?? '').trim();
  const coreApplicationKey = String(body.core_application_key ?? '').trim();
  if (!coreAccountId || !coreApplicationKey) {
    return NextResponse.json(
      { detail: 'core_account_id and core_application_key are required' },
      { status: 400 }
    );
  }

  const secure = process.env.NODE_ENV === 'production';
  const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 30 };
  const res = NextResponse.json({
    connected: false,
    mode: process.env.CIN7_MODE === 'demo' ? 'demo' : 'live',
    core_connected: true,
    omni_connected: Boolean(body.omni_username && body.omni_api_key),
    message: 'Credentials saved. Click Connect to activate.',
  });

  res.cookies.set('cin7_core_account_id', coreAccountId, common);
  res.cookies.set('cin7_core_application_key', coreApplicationKey, common);
  if (body.omni_username) res.cookies.set('cin7_omni_username', body.omni_username, common);
  if (body.omni_api_key) res.cookies.set('cin7_omni_api_key', body.omni_api_key, common);
  res.cookies.set('cin7_connected', '0', common);
  return res;
}

