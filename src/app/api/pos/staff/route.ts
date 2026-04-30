import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPosStore } from '@/lib/pos/mock-store';

export async function GET() {
  const store = getPosStore();
  return NextResponse.json({ data: store.staff });
}

export async function POST(request: NextRequest) {
  const store = getPosStore();
  const body = (await request.json()) as {
    staff_code?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    primary_location_code?: string;
    is_active?: boolean;
  };

  const staffCode = String(body.staff_code ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();
  const locationCode = String(body.primary_location_code ?? '').trim();

  if (!staffCode || !fullName || !locationCode) {
    return NextResponse.json(
      { detail: 'staff_code, full_name, and primary_location_code are required' },
      { status: 400 }
    );
  }

  if (store.staff.some((staff) => staff.staff_code.toLowerCase() == staffCode.toLowerCase())) {
    return NextResponse.json({ detail: 'Staff code already exists' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const created = {
    id: randomUUID(),
    staff_code: staffCode,
    full_name: fullName,
    email: body.email ? String(body.email) : null,
    phone: body.phone ? String(body.phone) : null,
    primary_location_code: locationCode,
    can_sell_at_locations: [locationCode],
    is_active: body.is_active !== false,
    created_at: now,
    updated_at: now,
  };

  store.staff.unshift(created);
  return NextResponse.json(created, { status: 201 });
}
