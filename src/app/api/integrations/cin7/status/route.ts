import { NextRequest, NextResponse } from 'next/server';
import { getCin7RegisteredConnectors } from '@/lib/integrations/cin7-connectors';
import { getCin7CoreCredentials, getCin7Mode, pingCin7Core } from '@/lib/integrations/cin7-core';

export async function GET(request: NextRequest) {
  const mode = getCin7Mode();
  const creds = getCin7CoreCredentials(request);
  const connectedCookie = request.cookies.get('cin7_connected')?.value === '1';

  if (!creds) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      core_connected: false,
      omni_connected: false,
      connector_allowlist: getCin7RegisteredConnectors(),
      message: 'Missing Cin7 Core credentials.',
    });
  }

  const apiOk = await pingCin7Core(creds);
  const omniConfigured = Boolean(
    (request.cookies.get('cin7_omni_username')?.value?.trim() &&
      request.cookies.get('cin7_omni_api_key')?.value?.trim()) ||
      (process.env.CIN7_OMNI_USERNAME?.trim() && process.env.CIN7_OMNI_API_KEY?.trim())
  );

  if (!apiOk) {
    return NextResponse.json({
      connected: false,
      mode,
      core_connected: false,
      omni_connected: omniConfigured,
      connector_allowlist: getCin7RegisteredConnectors(),
      message:
        'Cin7 Core API did not accept credentials. Check account id, application key, and that outbound calls use an IP allowed in Cin7 (see connector list).',
    });
  }

  const connected = connectedCookie && apiOk;

  return NextResponse.json({
    connected,
    mode,
    core_connected: true,
    omni_connected: omniConfigured,
    connector_allowlist: getCin7RegisteredConnectors(),
    message: connected
      ? 'Cin7 Core API reachable and integration is active.'
      : 'Cin7 Core API verified. Click Connect to activate.',
  });
}
