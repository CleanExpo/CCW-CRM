import { NextRequest, NextResponse } from 'next/server';
import { getCin7RegisteredConnectors } from '@/lib/integrations/cin7-connectors';
import { getCin7CoreCredentials, getCin7Mode, pingCin7Core } from '@/lib/integrations/cin7-core';

export async function POST(request: NextRequest) {
  const creds = getCin7CoreCredentials(request);
  if (!creds) {
    return NextResponse.json({ detail: 'Cin7 Core credentials are not configured.' }, { status: 400 });
  }

  const apiOk = await pingCin7Core(creds);
  if (!apiOk) {
    return NextResponse.json(
      {
        detail:
          'Cannot reach Cin7 Core API with these credentials. Confirm keys and IP allowlisting for your API connectors.',
        connector_allowlist: getCin7RegisteredConnectors(),
      },
      { status: 401 }
    );
  }

  const mode = getCin7Mode();
  const omniConfigured = Boolean(
    (request.cookies.get('cin7_omni_username')?.value?.trim() &&
      request.cookies.get('cin7_omni_api_key')?.value?.trim()) ||
      (process.env.CIN7_OMNI_USERNAME?.trim() && process.env.CIN7_OMNI_API_KEY?.trim())
  );

  const response = NextResponse.json({
    connected: true,
    mode,
    core_connected: true,
    omni_connected: omniConfigured,
    connector_allowlist: getCin7RegisteredConnectors(),
    message: 'Connected to Cin7 Core.',
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
