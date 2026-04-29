import { NextRequest, NextResponse } from 'next/server';
import {
  getConfiguredTokenSource,
  getXeroMode,
  hasLiveClientCredentials,
} from '@/lib/integrations/xero';

export async function GET(request: NextRequest) {
  const mode = getXeroMode();

  if (mode === 'demo') {
    return NextResponse.json({
      connected: true,
      mode: 'demo',
      tenant_name: 'Demo Organization',
      tenant_id: 'demo-tenant',
      message: 'Demo mode active. No real Xero API calls are made.',
    });
  }

  if (!hasLiveClientCredentials()) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      message: 'Missing Xero OAuth credentials.',
    });
  }

  const tokens = getConfiguredTokenSource(request);
  if (!tokens) {
    return NextResponse.json({
      connected: false,
      mode: 'live',
      message: 'Not connected. Click Connect to authorize with Xero.',
    });
  }

  return NextResponse.json({
    connected: true,
    mode: 'live',
    tenant_id: tokens.tenantId,
    tenant_name: tokens.tenantId,
  });
}
