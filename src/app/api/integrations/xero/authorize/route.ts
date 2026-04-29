import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { buildXeroAuthorizeUrl, getXeroMode, hasLiveClientCredentials } from '@/lib/integrations/xero';

export async function GET() {
  const mode = getXeroMode();
  if (mode === 'demo') {
    return NextResponse.json({
      mode: 'demo',
      authorization_url: '',
      state: 'demo-state',
      instructions: 'Demo mode active. Set XERO_MODE=live to enable real OAuth.',
    });
  }

  if (!hasLiveClientCredentials()) {
    return NextResponse.json(
      { detail: 'Missing Xero client credentials or redirect URI.' },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const authorizationUrl = buildXeroAuthorizeUrl(state);
  return NextResponse.json({
    mode: 'live',
    authorization_url: authorizationUrl,
    state,
  });
}

