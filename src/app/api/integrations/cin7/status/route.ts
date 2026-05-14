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
      message:
        'Missing Cin7 credentials. Set Cin7 Omni (CIN7_OMNI_USERNAME + CIN7_OMNI_API_KEY or CIN7_OMNI_CONNECTION_KEY) or Core keys in your environment, or save them from Settings.',
    });
  }

  const corePingOk = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniPingOk = omniCreds ? await pingCin7Omni(omniCreds) : false;
  const apiOk = corePingOk || omniPingOk;

  if (!apiOk) {
    const parts: string[] = [];
    if (coreCreds && !corePingOk) {
      parts.push(
        'Cin7 Core rejected these credentials or is unreachable (account ID, application key, and connector IP allowlisting in Cin7).'
      );
    }
    if (omniCreds && !omniPingOk) {
      parts.push(
        'Cin7 Omni rejected these credentials or is unreachable (check API username and connection key / API key).'
      );
    }
    if (parts.length === 0) {
      parts.push('Could not verify Cin7 connectivity.');
    }

    return NextResponse.json({
      connected: false,
      mode,
      core_connected: corePingOk,
      omni_connected: omniPingOk,
      connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
      message: parts.join(' '),
    });
  }

  const connected = connectedCookie && apiOk;

  let message: string;
  if (connected) {
    if (corePingOk && omniPingOk) {
      message = 'Cin7 Core and Omni are reachable; integration is active.';
    } else if (corePingOk) {
      message = 'Cin7 Core is reachable; integration is active.';
    } else {
      message =
        'Cin7 Omni is reachable (read-only). Product, customer, and order counts sync into this app when you run sync.';
    }
  } else if (corePingOk && omniPingOk) {
    message = 'Cin7 Core and Omni verified. Click Connect to start syncing.';
  } else if (corePingOk) {
    message = 'Cin7 Core verified. Click Connect to start syncing.';
  } else {
    message =
      'Cin7 Omni verified (read-only API). Click Connect to activate inbound sync from your live Cin7 account.';
  }

  return NextResponse.json({
    connected,
    mode,
    core_connected: corePingOk,
    omni_connected: omniPingOk,
    connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
    message,
  });
}
