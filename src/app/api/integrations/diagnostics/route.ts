import { NextResponse } from 'next/server';
import { getIntegrationDiagnostics } from '@/lib/integrations/diagnostics';

export async function GET() {
  return NextResponse.json({ items: getIntegrationDiagnostics() });
}
