import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, jsonDetail } from '@/lib/auth/http';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { bulkUnlist } from '@/lib/integrations/marketplace-dev-store';
import type { BulkUnlistItem } from '@/lib/api/marketplace';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { items?: BulkUnlistItem[] };
  if (!Array.isArray(body.items)) {
    return jsonDetail('items array is required', 422);
  }
  return NextResponse.json(bulkUnlist(scope.userId, body.items));
}
