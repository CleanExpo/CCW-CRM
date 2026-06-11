import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getPosStore } from '@/lib/pos/mock-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const store = getPosStore(workspaceId);
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    location_type?: 'physical' | 'virtual';
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    timezone?: string;
    is_active?: boolean;
  };

  const index = store.locations.findIndex((location) => location.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Location not found' }, { status: 404 });
  }

  const current = store.locations[index];
  store.locations[index] = {
    ...current,
    name: body.name ? String(body.name).trim() : current.name,
    location_type: body.location_type ?? current.location_type,
    address: body.address !== undefined ? (body.address ? String(body.address).trim() : null) : current.address,
    city: body.city !== undefined ? (body.city ? String(body.city).trim() : null) : current.city,
    state: body.state !== undefined ? (body.state ? String(body.state).trim() : null) : current.state,
    postal_code:
      body.postal_code !== undefined
        ? body.postal_code
          ? String(body.postal_code).trim()
          : null
        : current.postal_code,
    country: body.country ? String(body.country).trim() : current.country,
    timezone: body.timezone ? String(body.timezone).trim() : current.timezone,
    is_active: body.is_active ?? current.is_active,
    updated_at: new Date().toISOString(),
  };

  return NextResponse.json(store.locations[index]);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const store = getPosStore(workspaceId);
  const { id } = await params;
  const index = store.locations.findIndex((location) => location.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Location not found' }, { status: 404 });
  }

  const removed = store.locations[index];
  store.locations.splice(index, 1);
  store.terminals = store.terminals.filter((terminal) => terminal.location_code !== removed.code);
  return NextResponse.json({ success: true });
}
