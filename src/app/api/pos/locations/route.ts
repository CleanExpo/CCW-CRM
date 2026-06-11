import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getPosStore } from '@/lib/pos/mock-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const store = getPosStore(scope.userId);
  return NextResponse.json({ data: store.locations });
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const store = getPosStore(scope.userId);
  const body = (await request.json()) as {
    code?: string;
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

  const code = String(body.code ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  if (!code || !name) {
    return NextResponse.json({ detail: 'code and name are required' }, { status: 400 });
  }

  if (store.locations.some((location) => location.code === code)) {
    return NextResponse.json({ detail: 'Location code already exists' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const created = {
    id: randomUUID(),
    code,
    name,
    location_type: body.location_type ?? 'physical',
    address: body.address ? String(body.address) : null,
    city: body.city ? String(body.city) : null,
    state: body.state ? String(body.state) : null,
    postal_code: body.postal_code ? String(body.postal_code) : null,
    country: body.country ? String(body.country) : 'Australia',
    timezone: body.timezone ? String(body.timezone) : 'Australia/Brisbane',
    is_active: body.is_active !== false,
    created_at: now,
    updated_at: now,
  };

  store.locations.unshift(created);
  return NextResponse.json(created, { status: 201 });
}
