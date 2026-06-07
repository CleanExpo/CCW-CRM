import { NextRequest, NextResponse } from 'next/server';
import { getUpstreamApiBase } from '@/lib/api/backend-url';
import { requireAuthScope } from '@/lib/auth/data-scope';
import * as prismaStore from '@/lib/workflows/prisma-workflows';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
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

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const row = await prismaStore.getWorkflowTemplate(scope.userId, id);
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

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const updated = await prismaStore.updateWorkflowTemplate(scope.userId, id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
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

  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const ok = await prismaStore.deleteWorkflowTemplate(scope.userId, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
