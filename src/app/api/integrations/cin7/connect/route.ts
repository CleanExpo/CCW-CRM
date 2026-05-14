import { NextRequest, NextResponse } from 'next/server';
import { getCin7RegisteredConnectors } from '@/lib/integrations/cin7-connectors';
import { getCin7CoreCredentials, getCin7Mode, pingCin7Core } from '@/lib/integrations/cin7-core';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';

export async function POST(request: NextRequest) {
  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);

  if (!coreCreds && !omniCreds) {
    return NextResponse.json(
      { detail: 'Cin7 is not configured. Add Core and/or Omni credentials first.' },
      { status: 400 }
    );
  }

  const coreOk = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniOk = omniCreds ? await pingCin7Omni(omniCreds) : false;

  if (!coreOk && !omniOk) {
    const detailParts: string[] = [];
    if (coreCreds) {
      detailParts.push(
        'Cin7 Core did not accept these credentials (check keys and API connector IP allowlisting).'
      );
    }
    if (omniCreds) {
      detailParts.push(
        'Cin7 Omni did not accept these credentials (check API username and connection key).'
      );
    }
    return NextResponse.json(
      {
        detail: detailParts.join(' ') || 'Cannot reach Cin7 with the configured credentials.',
        connector_allowlist: getCin7RegisteredConnectors(),
      },
      { status: 401 }
    );
  }

  const mode = getCin7Mode();

  let msg: string;
  if (coreOk && omniOk) {
    msg = 'Connected to Cin7 Core and Omni.';
  } else if (coreOk) {
    msg = 'Connected to Cin7 Core.';
  } else {
    msg = 'Connected to Cin7 Omni.';
  }

  const response = NextResponse.json({
    connected: true,
    mode,
    core_connected: coreOk,
    omni_connected: omniOk,
    connector_allowlist: getCin7RegisteredConnectors(),
    message: msg,
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
