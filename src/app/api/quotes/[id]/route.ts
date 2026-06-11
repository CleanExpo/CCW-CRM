import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { quoteDetailToApi } from '@/lib/db/quote-serialize';
import { buildQuoteLinesFromItems } from '@/lib/db/quote-mutations';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(_request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const row = await prisma.quote.findFirst({
      where: { id, ownerUserId: scope.userId },
      include: {
        customer: { select: { companyName: true } },
        lineItems: { include: { product: true } },
      },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    const { customer, ...q } = row;
    return NextResponse.json(quoteDetailToApi(q, customer?.companyName));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const existing = await prisma.quote.findFirst({ where: { id, ownerUserId: scope.userId } });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = (await request.json()) as {
      customer_id?: string;
      status?: string;
      valid_until?: string | null;
      notes?: string | null;
      items?: Array<{ product_id: string; quantity: number }>;
    };

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ detail: 'At least one line item is required' }, { status: 400 });
    }

    const lineData = await buildQuoteLinesFromItems(items, scope.userId);
    const total = lineData.reduce((s, l) => s + l.lineTotal, 0);

    if (body.customer_id !== undefined) {
      const target = await prisma.customer.findFirst({
        where: { id: String(body.customer_id), ownerUserId: scope.userId, isActive: true },
        select: { id: true },
      });
      if (!target) {
        return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
      }
    }

    let validUntil: Date | null | undefined = undefined;
    if (body.valid_until !== undefined) {
      if (body.valid_until === null || String(body.valid_until).trim() === '') {
        validUntil = null;
      } else {
        const d = new Date(String(body.valid_until));
        validUntil = Number.isNaN(d.getTime()) ? null : d;
      }
    }

    const row = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await tx.quoteLineItem.deleteMany({ where: { quoteId: id } });
      return tx.quote.update({
        where: { id },
        data: {
          customerId:
            body.customer_id !== undefined ? String(body.customer_id) : undefined,
          status: body.status !== undefined ? String(body.status) : undefined,
          total,
          validUntil,
          notes:
            body.notes === undefined
              ? undefined
              : body.notes === null
                ? null
                : String(body.notes),
          lineItems: {
            create: lineData.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: {
          customer: { select: { companyName: true } },
          lineItems: { include: { product: true } },
        },
      });
    });

    const { customer, ...q } = row;
    return NextResponse.json(quoteDetailToApi(q, customer?.companyName));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const existing = await prisma.quote.findFirst({
      where: { id, ownerUserId: scope.userId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    await prisma.quote.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted' });
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
