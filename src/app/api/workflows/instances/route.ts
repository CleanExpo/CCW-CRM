import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import { requireAuthScope } from '@/lib/auth/data-scope';
import * as prismaStore from '@/lib/workflows/prisma-workflows';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = getUpstreamApiBase();

  if (base) {
    try {
      const url = new URL(`${base}/api/workflows/instances`);
      request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => []);
      return NextResponse.json(Array.isArray(data) ? data : [], { status: response.status });
    } catch (e) {
      console.error('Upstream GET /api/workflows/instances:', e);
      return NextResponse.json({ error: 'Upstream workflow instances unavailable' }, { status: 502 });
    }
  }

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const template_id = request.nextUrl.searchParams.get('template_id') ?? undefined;
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  return NextResponse.json(
    await prismaStore.listWorkflowInstances(scope.userId, { template_id, status })
  );
}
