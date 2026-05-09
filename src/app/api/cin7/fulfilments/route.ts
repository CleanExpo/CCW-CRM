import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

function rowToApi(f: {
  id: string;
  cin7OrderMappingId: string;
  cin7FulfilmentId: string | null;
  orderReference: string | null;
  status: string;
  pickLocation: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: f.id,
    cin7_order_mapping_id: f.cin7OrderMappingId,
    cin7_fulfilment_id: f.cin7FulfilmentId,
    order_reference: f.orderReference,
    status: f.status,
    pick_location: f.pickLocation,
    tracking_number: f.trackingNumber,
    carrier: f.carrier,
    shipped_at: f.shippedAt?.toISOString() ?? null,
    delivered_at: f.deliveredAt?.toISOString() ?? null,
    notes: f.notes,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const status = searchParams.get('status');

    const where = {
      ownerUserId: scope.userId,
      ...(status ? { status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.salesFulfilment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesFulfilment.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(rowToApi),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      cin7_order_mapping_id?: string;
      pick_location?: string | null;
      notes?: string | null;
    };
    const mappingId = String(body.cin7_order_mapping_id ?? '').trim();
    if (!mappingId) {
      return NextResponse.json({ detail: 'cin7_order_mapping_id is required' }, { status: 400 });
    }

    let orderRef: string | null = null;
    const order = await prisma.order.findFirst({
      where: { id: mappingId, ownerUserId: scope.userId },
      select: { orderNumber: true },
    });
    if (order) orderRef = order.orderNumber;

    const row = await prisma.salesFulfilment.create({
      data: {
        ownerUserId: scope.userId,
        cin7OrderMappingId: mappingId,
        cin7FulfilmentId: `FUL-${Date.now()}`,
        orderReference: orderRef,
        status: 'pending',
        pickLocation: body.pick_location ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json(rowToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
