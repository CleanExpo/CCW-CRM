import { NextRequest, NextResponse } from 'next/server';

function getMode() {
  return process.env.CIN7_MODE === 'demo' ? 'demo' : 'live';
}

export async function GET(request: NextRequest) {
  const mode = getMode();
  const coreAccountId =
    request.cookies.get('cin7_core_account_id')?.value?.trim() ||
    process.env.CIN7_CORE_ACCOUNT_ID?.trim();
  const coreAppKey =
    request.cookies.get('cin7_core_application_key')?.value?.trim() ||
    process.env.CIN7_CORE_APPLICATION_KEY?.trim();
  const omniUser =
    request.cookies.get('cin7_omni_username')?.value?.trim() ||
    process.env.CIN7_OMNI_USERNAME?.trim();
  const omniApiKey =
    request.cookies.get('cin7_omni_api_key')?.value?.trim() || process.env.CIN7_OMNI_API_KEY?.trim();
  const connectedCookie = request.cookies.get('cin7_connected')?.value === '1';

  const coreConfigured = Boolean(coreAccountId && coreAppKey);
  const omniConfigured = Boolean(omniUser && omniApiKey);
  if (!coreConfigured) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      core_connected: false,
      omni_connected: false,
      message: 'Missing Cin7 Core credentials.',
    });
  }

  return NextResponse.json({
    connected: connectedCookie || mode === 'demo',
    mode,
    core_connected: true,
    omni_connected: omniConfigured,
    last_sync: new Date().toISOString(),
    message:
      connectedCookie || mode === 'demo'
        ? mode === 'demo'
          ? 'Connected in demo mode.'
          : 'Connected to Cin7.'
        : 'Credentials saved. Click Connect to activate.',
  });
}
