import { NextRequest, NextResponse } from 'next/server';
import { getCin7RegisteredConnectors } from '@/lib/integrations/cin7-connectors';
import { getCin7CoreCredentials, getCin7Mode, pingCin7Core } from '@/lib/integrations/cin7-core';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';

export async function GET(request: NextRequest) {
  const mode = getCin7Mode();
  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);
  const connectedCookie = request.cookies.get('cin7_connected')?.value === '1';

  if (!coreCreds && !omniCreds) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      core_connected: false,
      omni_connected: false,
      connector_allowlist: getCin7RegisteredConnectors(),
      message: 'Missing Cin7 credentials. Add Cin7 Core and/or Cin7 Omni (username + API key).',
    });
  }

  const corePingOk = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniPingOk = omniCreds ? await pingCin7Omni(omniCreds) : false;
  const apiOk = corePingOk || omniPingOk;

  if (!apiOk) {
    const parts: string[] = [];
    if (coreCreds && !corePingOk) {
      parts.push(
        'Cin7 Core API rejected these credentials or is unreachable (check account ID, application key, and connector IP allowlisting).'
      );
    }
    if (omniCreds && !omniPingOk) {
      parts.push('Cin7 Omni API rejected these credentials or is unreachable (check username and API key).');
    }
    if (parts.length === 0) {
      parts.push('Could not verify Cin7 connectivity.');
    }

    return NextResponse.json({
      connected: false,
      mode,
      core_connected: corePingOk,
      omni_connected: omniPingOk,
      connector_allowlist: getCin7RegisteredConnectors(),
      message: parts.join(' '),
    });
  }

  const connected = connectedCookie && apiOk;

  let message: string;
  if (connected) {
    if (corePingOk && omniPingOk) {
      message = 'Cin7 Core and Omni APIs reachable; integration is active.';
    } else if (corePingOk) {
      message = 'Cin7 Core API reachable and integration is active.';
    } else {
      message = 'Cin7 Omni API reachable and integration is active.';
    }
  } else if (corePingOk && omniPingOk) {
    message = 'Cin7 Core and Omni verified. Click Connect to activate.';
  } else if (corePingOk) {
    message = 'Cin7 Core API verified. Click Connect to activate.';
  } else {
    message = 'Cin7 Omni API verified. Click Connect to activate.';
  }

  return NextResponse.json({
    connected,
    mode,
    core_connected: corePingOk,
    omni_connected: omniPingOk,
    connector_allowlist: getCin7RegisteredConnectors(),
    message,
  });
}
