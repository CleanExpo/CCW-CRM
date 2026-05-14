import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { unifiedProducts } from '@/lib/integrations/marketplace-dev-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  void request;
  return NextResponse.json(unifiedProducts(scope.userId));
}
