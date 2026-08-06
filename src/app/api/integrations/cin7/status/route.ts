import { getCin7RegisteredConnectors } from '@/lib/integrations/cin7-connectors';
import { getCin7CoreCredentials, getCin7Mode, pingCin7Core } from '@/lib/integrations/cin7-core';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/cin7/status
 *
 * Default (fast): credentials present + not explicitly disconnected → connected.
 * Does not live-ping Cin7 (avoids rate limits and slow page loads).
 *
 * ?verify=true: live-ping Core/Omni and report reachability.
 *
 * Cookie semantics:
 * - cin7_connected=0 → user explicitly disconnected (stay disconnected until Connect)
 * - cin7_connected=1 or absent → connected when credentials exist
 */
export async function GET(request: NextRequest) {
  const mode = getCin7Mode();
  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);
  const cookieValue = request.cookies.get('cin7_connected')?.value;
  const explicitlyDisconnected = cookieValue === '0';
  const verify = request.nextUrl.searchParams.get('verify') === 'true';

  if (!coreCreds && !omniCreds) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      core_connected: false,
      omni_connected: false,
      verified: false,
      connector_allowlist: getCin7RegisteredConnectors(),
      message:
        'Missing Cin7 credentials. Set Cin7 Omni (CIN7_OMNI_USERNAME + CIN7_OMNI_API_KEY or CIN7_OMNI_CONNECTION_KEY) or Core keys in your environment, or save them from Settings.',
    });
  }

  // Fast path: env / saved credentials are enough to enable Sync + Reconciliation.
  if (!verify) {
    if (explicitlyDisconnected) {
      return NextResponse.json({
        connected: false,
        mode,
        core_connected: Boolean(coreCreds),
        omni_connected: Boolean(omniCreds),
        verified: false,
        connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
        message:
          'Cin7 credentials are configured but the integration is disconnected. Click Connect to enable sync.',
      });
    }

    const parts: string[] = [];
    if (omniCreds) parts.push('Omni');
    if (coreCreds) parts.push('Core');
    return NextResponse.json({
      connected: true,
      mode,
      core_connected: Boolean(coreCreds),
      omni_connected: Boolean(omniCreds),
      verified: false,
      connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
      message: `Cin7 ${parts.join(' + ')} credentials are configured. Sync is available. Use Refresh Status to live-verify the API.`,
    });
  }

  // Live verify path
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
      verified: true,
      connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
      message: parts.join(' '),
    });
  }

  if (explicitlyDisconnected) {
    return NextResponse.json({
      connected: false,
      mode,
      core_connected: corePingOk,
      omni_connected: omniPingOk,
      verified: true,
      connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
      message:
        'Cin7 API verified, but the integration is disconnected. Click Connect to enable sync.',
    });
  }

  let message: string;
  if (corePingOk && omniPingOk) {
    message = 'Cin7 Core and Omni are reachable; integration is active.';
  } else if (corePingOk) {
    message = 'Cin7 Core is reachable; integration is active.';
  } else {
    message =
      'Cin7 Omni is reachable (read-only). Product, customer, and order counts sync into this app when you run sync.';
  }

  return NextResponse.json({
    connected: true,
    mode,
    core_connected: corePingOk,
    omni_connected: omniPingOk,
    verified: true,
    connector_allowlist: coreCreds ? getCin7RegisteredConnectors() : [],
    message,
  });
}
