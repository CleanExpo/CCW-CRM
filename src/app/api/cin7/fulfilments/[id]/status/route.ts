import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: string;
      tracking_number?: string | null;
      carrier?: string | null;
      notes?: string | null;
    };

    const now = new Date();
    const extra: {
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
    } = {};

    if (body.status === 'shipped') {
      extra.shippedAt = now;
    }
    if (body.status === 'delivered') {
      extra.deliveredAt = now;
    }

    const row = await prisma.salesFulfilment.update({
      where: { id },
      data: {
        status: body.status != null ? String(body.status) : undefined,
        trackingNumber:
          body.tracking_number !== undefined ? body.tracking_number : undefined,
        carrier: body.carrier !== undefined ? body.carrier : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        ...extra,
      },
    });
    return NextResponse.json(rowToApi(row));
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
