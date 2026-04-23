import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { lineToApi, refreshGrnTotals } from '@/lib/db/grn-serialize';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: grnId } = await context.params;
    const grn = await prisma.goodsReceipt.findUnique({ where: { id: grnId } });
    if (!grn) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (grn.status !== 'draft') {
      return NextResponse.json({ detail: 'Can only edit draft receipts' }, { status: 400 });
    }

    const body = (await request.json()) as {
      product_id?: string;
      sku?: string;
      product_name?: string;
      ordered_qty?: number;
      received_qty?: number;
      put_away_location?: string;
      batch_number?: string;
      expiry_date?: string;
      condition?: string;
      notes?: string;
    };

    let sku = String(body.sku ?? '').trim();
    let productName = String(body.product_name ?? '').trim();
    let productId: string | null = body.product_id ?? null;

    if (productId) {
      const p = await prisma.product.findUnique({ where: { id: productId } });
      if (!p) {
        return NextResponse.json({ detail: 'Product not found' }, { status: 400 });
      }
      sku = p.sku;
      productName = p.name;
    }

    if (!sku || !productName) {
      return NextResponse.json({ detail: 'sku and product_name are required' }, { status: 400 });
    }

    const receivedQty = Math.max(0, Math.floor(Number(body.received_qty ?? 0)));
    const line = await prisma.goodsReceiptLine.create({
      data: {
        goodsReceiptId: grnId,
        productId,
        sku,
        productName,
        orderedQty: body.ordered_qty != null ? Math.floor(Number(body.ordered_qty)) : null,
        receivedQty,
        putAwayLocation: body.put_away_location ?? null,
        batchNumber: body.batch_number ?? null,
        expiryDate: body.expiry_date ? new Date(body.expiry_date) : null,
        condition: body.condition ?? 'good',
        notes: body.notes ?? null,
      },
    });

    await refreshGrnTotals(grnId);
    return NextResponse.json(lineToApi(line), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
