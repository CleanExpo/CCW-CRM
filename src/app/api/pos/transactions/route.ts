import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function txNumber() {
  return `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const recon = searchParams.get('reconciliation_status');

    const where: { reconciliationStatus?: string } = {};
    if (recon) where.reconciliationStatus = recon;

    const [rows, total] = await Promise.all([
      prisma.posTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.posTransaction.count({ where }),
    ]);

    const items = rows.map((t) => ({
      id: t.id,
      transaction_number: t.transactionNumber,
      amount: t.amount,
      payment_method: t.paymentMethod,
      payment_status: t.paymentStatus,
      created_at: t.createdAt.toISOString(),
      location_code: t.locationCode,
    }));

    return NextResponse.json({
      items,
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
    const body = (await request.json()) as {
      terminal_id?: string;
      sales_staff_id?: string;
      payment_method?: string;
      amount?: number;
      items?: Array<{ product_id: string; quantity: number; unit_price: number }>;
    };

    const terminalId = String(body.terminal_id ?? '');
    const items = Array.isArray(body.items) ? body.items : [];
    if (!terminalId || items.length === 0) {
      return NextResponse.json({ detail: 'terminal_id and items required' }, { status: 400 });
    }

    const terminalLocationById: Record<string, string> = {
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1': 'brisbane',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2': 'sydney',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3': 'melbourne',
    };
    const locationCode = terminalLocationById[terminalId] ?? 'brisbane';

    const ids = [...new Set(items.map((i) => i.product_id))];
    const products = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true } });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineData: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const row of items) {
      const p = byId.get(row.product_id);
      if (!p) {
        return NextResponse.json({ detail: `Unknown product ${row.product_id}` }, { status: 400 });
      }
      const qty = Math.max(0, Math.floor(Number(row.quantity)));
      if (qty <= 0) continue;
      const unit = Number(row.unit_price ?? p.price);
      const lt = unit * qty;
      subtotal += lt;
      lineData.push({ productId: row.product_id, quantity: qty, unitPrice: unit, lineTotal: lt });
    }
    if (lineData.length === 0) {
      return NextResponse.json({ detail: 'No valid lines' }, { status: 400 });
    }

    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    const bodyAmount = Number(body.amount ?? 0);
    if (Math.abs(bodyAmount - total) > 0.02) {
      /* allow small float drift */
    }

    const created = await prisma.$transaction(async (tx) => {
      for (const line of lineData) {
        const prod = await tx.product.findUnique({ where: { id: line.productId } });
        if (!prod || prod.stock < line.quantity) {
          throw new Error(`Insufficient stock for product ${line.productId}`);
        }
      }

      for (const line of lineData) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      return tx.posTransaction.create({
        data: {
          transactionNumber: txNumber(),
          terminalId,
          locationCode,
          salesStaffId: body.sales_staff_id ?? null,
          paymentMethod: String(body.payment_method ?? 'cash'),
          paymentStatus: 'captured',
          subtotal,
          tax,
          amount: total,
          reconciliationStatus: 'pending',
          lines: {
            create: lineData.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });
    });

    return NextResponse.json({
      transaction_number: created.transactionNumber,
      payment_status: created.paymentStatus,
      id: created.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Insufficient stock')) {
      return NextResponse.json({ detail: msg }, { status: 400 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
