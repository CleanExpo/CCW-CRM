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
  const omniUsername = String(body.omni_username ?? '').trim();
  const omniApiKey = String(body.omni_api_key ?? '').trim();

  const hasCorePair = Boolean(coreAccountId && coreApplicationKey);
  const hasOmniPair = Boolean(omniUsername && omniApiKey);

  if (!hasCorePair && !hasOmniPair) {
    return NextResponse.json(
      {
        detail:
          'Provide Cin7 Core (account ID + application key) and/or Cin7 Omni (API username + connection key). At least one complete pair is required.',
      },
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

  const res = NextResponse.json({
    connected: false,
    mode: process.env.CIN7_MODE === 'demo' ? 'demo' : 'live',
    core_connected: hasCorePair,
    omni_connected: hasOmniPair,
    message: 'Credentials saved. Click Connect to activate.',
  });

  if (hasCorePair) {
    res.cookies.set('cin7_core_account_id', coreAccountId, common);
    res.cookies.set('cin7_core_application_key', coreApplicationKey, common);
  }
  if (hasOmniPair) {
    res.cookies.set('cin7_omni_username', omniUsername, common);
    res.cookies.set('cin7_omni_api_key', omniApiKey, common);
  }
  res.cookies.set('cin7_connected', '0', common);
  return res;
}
