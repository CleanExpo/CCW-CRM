import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const coreAccountId =
    request.cookies.get('cin7_core_account_id')?.value?.trim() ||
    process.env.CIN7_CORE_ACCOUNT_ID?.trim();
  const coreAppKey =
    request.cookies.get('cin7_core_application_key')?.value?.trim() ||
    process.env.CIN7_CORE_APPLICATION_KEY?.trim();
  if (!coreAccountId || !coreAppKey) {
    return NextResponse.json({ detail: 'Cin7 Core credentials are not configured.' }, { status: 400 });
  }

  const mode = process.env.CIN7_MODE === 'demo' ? 'demo' : 'live';
  const response = NextResponse.json({
    connected: true,
    mode,
    core_connected: true,
    omni_connected: Boolean(
      request.cookies.get('cin7_omni_username')?.value?.trim() ||
        process.env.CIN7_OMNI_USERNAME?.trim()
    ),
    message: mode === 'demo' ? 'Connected in demo mode.' : 'Connected to Cin7.',
  });
  response.cookies.set('cin7_connected', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

