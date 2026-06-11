import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getPosStore } from '@/lib/pos/mock-store';
import { resolvePrice } from '@/lib/pricing/resolve-price';

function txNumber() {
  return `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = limitParam > 0 ? limitParam : parseInt(searchParams.get('page_size') || '50');
    const recon = searchParams.get('reconciliation_status');

    const where: {
      ownerUserId: string;
      reconciliationStatus?: string;
    } = { ownerUserId: scope.userId };
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
      data: items,
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
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      terminal_id?: string;
      sales_staff_id?: string;
      payment_method?: string;
      amount?: number;
      /** customer_id is optional; when provided the tier resolver runs. */
      customer_id?: string;
      items?: Array<{
        product_id: string;
        quantity: number;
        /** Caller-supplied unit_price is treated as an explicit override (audit trail).
         *  When absent, the tier/catalogue resolver determines the price. */
        unit_price?: number;
      }>;
    };

    const terminalId = String(body.terminal_id ?? '');
    const items = Array.isArray(body.items) ? body.items : [];
    if (!terminalId) {
      return NextResponse.json({ detail: 'terminal_id is required' }, { status: 400 });
    }

    const workspaceId = await getWorkspaceIdForUser(scope.userId);
    if (!workspaceId) {
      return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
    }

    const store = getPosStore(workspaceId);
    const locationCode =
      store.terminals.find((terminal) => terminal.id === terminalId)?.location_code ?? 'brisbane';

    const uid = scope.userId;

    if (items.length === 0) {
      const amount = Number(body.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ detail: 'amount must be greater than 0' }, { status: 400 });
      }

      const created = await prisma.posTransaction.create({
        data: {
          ownerUserId: uid,
          transactionNumber: txNumber(),
          terminalId,
          locationCode,
          salesStaffId: body.sales_staff_id ?? null,
          paymentMethod: String(body.payment_method ?? 'cash'),
          paymentStatus: String(body.payment_method ?? 'bank_transfer') === 'bank_transfer' ? 'pending' : 'captured',
          subtotal: amount,
          tax: 0,
          amount,
          reconciliationStatus: 'pending',
        },
      });

      return NextResponse.json({
        transaction_number: created.transactionNumber,
        payment_status: created.paymentStatus,
        amount: created.amount,
        id: created.id,
      });
    }

    const ids = [...new Set(items.map((i) => i.product_id))];
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true, ownerUserId: uid },
    });
    const productExists = new Set(products.map((p) => p.id));
    const customerId = body.customer_id ?? null;

    let subtotal = 0;
    const lineData: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const row of items) {
      if (!productExists.has(row.product_id)) {
        return NextResponse.json({ detail: `Unknown product ${row.product_id}` }, { status: 400 });
      }
      const qty = Math.max(0, Math.floor(Number(row.quantity)));
      if (qty <= 0) continue;

      let unit: number;
      if (row.unit_price !== undefined && Number.isFinite(Number(row.unit_price))) {
        // Explicit caller override — honour as-is (e.g. manual staff discount at POS).
        unit = Number(row.unit_price);
      } else {
        const resolved = await resolvePrice(customerId, row.product_id, qty, [uid]);
        unit = resolved.unitPrice;
      }

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
        const prod = await tx.product.findFirst({
          where: { id: line.productId, ownerUserId: uid },
        });
        if (!prod || prod.stock < line.quantity) {
          throw new Error(`Insufficient stock for product ${line.productId}`);
        }
      }

      for (const line of lineData) {
        const dec = await tx.product.updateMany({
          where: { id: line.productId, ownerUserId: uid },
          data: { stock: { decrement: line.quantity } },
        });
        if (dec.count !== 1) {
          throw new Error(`Stock update failed for product ${line.productId}`);
        }
      }

      return tx.posTransaction.create({
        data: {
          ownerUserId: uid,
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
      amount: created.amount,
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
