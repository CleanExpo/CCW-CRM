import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { cleanupDuplicateCustomers } from '@/lib/integrations/cin7-duplicate-cleanup';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const result = await cleanupDuplicateCustomers(scope.userId);
  return NextResponse.json({ status: 'ok', ...result });
}
