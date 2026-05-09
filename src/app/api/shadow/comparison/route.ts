import { NextRequest } from 'next/server';
import { jsonOk } from '@/lib/auth/http';
import { requireShadowAuth } from '@/app/api/shadow/_auth';

export async function GET(request: NextRequest) {
  const auth = await requireShadowAuth(request);
  if (!auth.ok) return auth.response;

  const entityType = request.nextUrl.searchParams.get('entity_type') || 'order';
  return jsonOk({
    entity_type: entityType,
    total_observed: 0,
    match_rate: 0,
    distribution: {} as Record<string, number>,
    interpretation: 'No shadow comparison samples recorded yet.',
  });
}
