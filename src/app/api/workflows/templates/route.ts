import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import * as store from '@/lib/server/workflow-automation-store';

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

  return NextResponse.json(store.listTemplates());
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

  try {
    const body = await request.json();
    const created = store.createTemplate(body);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid template payload' }, { status: 400 });
  }
}
