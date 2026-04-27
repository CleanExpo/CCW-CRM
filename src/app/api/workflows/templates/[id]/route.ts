import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import * as store from '@/lib/server/workflow-automation-store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getUpstreamApiBase();
  const { id } = await params;

  if (base) {
    try {
      const response = await fetch(`${base}/api/workflows/templates/${id}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return NextResponse.json(data ?? { error: 'Not found' }, { status: response.status });
      }
      return NextResponse.json(data);
    } catch (e) {
      console.error('Upstream GET workflow template:', e);
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
    }
  }

  const row = store.getTemplate(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getUpstreamApiBase();
  const { id } = await params;

  if (base) {
    try {
      const body = await request.json();
      const response = await fetch(`${base}/api/workflows/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    } catch (e) {
      console.error('Upstream PUT workflow template:', e);
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
    }
  }

  try {
    const body = await request.json();
    const updated = store.updateTemplate(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getUpstreamApiBase();
  const { id } = await params;

  if (base) {
    try {
      const response = await fetch(`${base}/api/workflows/templates/${id}`, { method: 'DELETE' });
      if (response.status === 204) {
        return new NextResponse(null, { status: 204 });
      }
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    } catch (e) {
      console.error('Upstream DELETE workflow template:', e);
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 });
    }
  }

  const ok = store.deleteTemplate(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
