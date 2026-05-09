import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { grnToApi } from '@/lib/db/grn-serialize';

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
      prisma.goodsReceipt.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(grnToApi),
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
      po_reference?: string;
      supplier_name?: string;
      received_by?: string;
      received_date?: string;
      location_id?: string;
      notes?: string | null;
    };

    const poRef = String(body.po_reference ?? '').trim();
    if (!poRef) {
      return NextResponse.json({ detail: 'po_reference is required' }, { status: 400 });
    }

    const receivedDate = body.received_date
      ? new Date(body.received_date)
      : new Date();

    const row = await prisma.goodsReceipt.create({
      data: {
        ownerUserId: scope.userId,
        poReference: poRef,
        supplierName: body.supplier_name ?? null,
        receivedBy: body.received_by ?? null,
        receivedDate,
        locationId: String(body.location_id ?? 'default'),
        notes: body.notes ?? null,
        status: 'draft',
      },
      include: { lines: true },
    });

    return NextResponse.json(grnToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
