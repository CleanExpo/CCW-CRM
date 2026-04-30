import { NextRequest, NextResponse } from 'next/server';
import { getPosStore } from '@/lib/pos/mock-store';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const store = getPosStore();
  const { id } = await params;
  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    phone?: string;
    primary_location_code?: string;
    is_active?: boolean;
  };

  const index = store.staff.findIndex((staff) => staff.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Staff member not found' }, { status: 404 });
  }

  const current = store.staff[index];
  const updated = {
    ...current,
    full_name: body.full_name ? String(body.full_name).trim() : current.full_name,
    email: body.email !== undefined ? (body.email ? String(body.email).trim() : null) : current.email,
    phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : null) : current.phone,
    primary_location_code: body.primary_location_code
      ? String(body.primary_location_code).trim()
      : current.primary_location_code,
    is_active: body.is_active ?? current.is_active,
    updated_at: new Date().toISOString(),
  };

  store.staff[index] = updated;
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const store = getPosStore();
  const { id } = await params;
  const index = store.staff.findIndex((staff) => staff.id === id);
  if (index < 0) {
    return NextResponse.json({ detail: 'Staff member not found' }, { status: 404 });
  }

  store.staff.splice(index, 1);
  return NextResponse.json({ success: true });
}
