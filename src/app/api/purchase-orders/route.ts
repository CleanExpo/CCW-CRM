import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { purchaseOrderToApi } from '@/lib/db/purchase-order-serialize';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  supplier: true,
  lines: { include: { product: true } },
} satisfies Prisma.PurchaseOrderInclude;

function genPoNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `PO-${y}${m}${day}-${r}`;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const location = searchParams.get('location');

    const where: Prisma.PurchaseOrderWhereInput = { ownerUserId: scope.userId };
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status && status !== 'all') where.status = status;
    if (location && location !== 'all') where.deliveryLocation = location;

    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(purchaseOrderToApi),
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
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const supplierId = String(body.supplier_id ?? '').trim();
    const deliveryLocation = String(body.delivery_location ?? 'brisbane');
    const rawItems = body.items as Array<{ product_id?: string; quantity?: number; unit_cost?: number }>;
    if (!supplierId || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ detail: 'supplier_id and items required' }, { status: 400 });
    }

    const ids = [...new Set(rawItems.map((i) => String(i.product_id ?? '')).filter(Boolean))];
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, ownerUserId: scope.userId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ detail: 'Supplier not found' }, { status: 404 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, ownerUserId: scope.userId, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineCreates: Array<{
      productId: string;
      quantity: number;
      quantityReceived: number;
      unitCost: number;
      subtotal: number;
    }> = [];
    for (const row of rawItems) {
      const pid = String(row.product_id ?? '');
      const qty = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
      const unitCost = Number(row.unit_cost ?? 0);
      if (!pid || qty <= 0) continue;
      const p = byId.get(pid);
      if (!p) {
        return NextResponse.json({ detail: `Unknown product ${pid}` }, { status: 400 });
      }
      const lineSub = qty * unitCost;
      subtotal += lineSub;
      lineCreates.push({
        productId: pid,
        quantity: qty,
        quantityReceived: 0,
        unitCost,
        subtotal: lineSub,
      });
    }
    if (lineCreates.length === 0) {
      return NextResponse.json({ detail: 'No valid line items' }, { status: 400 });
    }

    const shipping = body.shipping_cost != null ? Number(body.shipping_cost) : 0;
    const tax = subtotal * 0.1;
    const total = subtotal + tax + shipping;

    const created = await prisma.purchaseOrder.create({
      data: {
        ownerUserId: scope.userId,
        poNumber: genPoNumber(),
        supplierId,
        deliveryLocation,
        status: 'draft',
        expectedDeliveryDate: body.expected_delivery_date
          ? new Date(String(body.expected_delivery_date))
          : null,
        notes: body.notes != null ? String(body.notes) : null,
        shippingCost: shipping || null,
        subtotal,
        tax,
        total,
        lines: { create: lineCreates },
      },
      include: INCLUDE,
    });

    return NextResponse.json(purchaseOrderToApi(created), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
