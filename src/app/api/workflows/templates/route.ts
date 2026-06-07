import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import { requireAuthScope } from '@/lib/auth/data-scope';
import * as prismaStore from '@/lib/workflows/prisma-workflows';
import { ensureDefaultWorkflowTemplates } from '@/lib/workflows/workflow-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const base = getUpstreamApiBase();
  if (base) {
    try {
      const url = new URL(`${base}/api/workflows/templates`);
      request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => []);
      return NextResponse.json(Array.isArray(data) ? data : [], { status: response.status });
    } catch (e) {
      console.error('Upstream GET /api/workflows/templates:', e);
      return NextResponse.json({ error: 'Upstream workflow templates unavailable' }, { status: 502 });
    }
  }

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  await ensureDefaultWorkflowTemplates(scope.userId);
  return NextResponse.json(await prismaStore.listWorkflowTemplates(scope.userId));
}

export async function POST(request: NextRequest) {
  const base = getUpstreamApiBase();
  if (base) {
    try {
      const body = await request.json();
      const response = await fetch(`${base}/api/workflows/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    } catch (e) {
      console.error('Upstream POST /api/workflows/templates:', e);
      return NextResponse.json({ error: 'Upstream workflow templates unavailable' }, { status: 502 });
    }
  }

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const created = await prismaStore.createWorkflowTemplate(scope.userId, body);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid template payload' }, { status: 400 });
  }
}
