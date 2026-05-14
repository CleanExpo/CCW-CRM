import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { syncProducts } from '@/lib/integrations/marketplace-dev-store';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  void parsed.body;
  return NextResponse.json(syncProducts(scope.userId));
}
