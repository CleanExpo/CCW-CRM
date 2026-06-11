import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { quoteToApi } from '@/lib/db/api-serialize';
import { buildQuoteLinesFromItems, nextQuoteNumber } from '@/lib/db/quote-mutations';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Prisma.QuoteWhereInput = { ownerUserId: scope.userId };
    if (search) {
      where.quoteNumber = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          customer: { select: { companyName: true } },
          _count: { select: { lineItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quote.count({ where }),
    ]);

    const items = rows.map((q: typeof rows[number]) => {
      const { customer, _count, ...rest } = q;
      return {
        ...quoteToApi(rest, customer?.companyName),
        quote_date: q.createdAt.toISOString(),
        item_count: _count.lineItems,
      };
    });

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      customer_id?: string;
      quote_number?: string;
      status?: string;
      valid_until?: string | null;
      notes?: string | null;
      items?: Array<{ product_id: string; quantity: number }>;
    };

    const customerId = String(body.customer_id ?? '');
    const items = Array.isArray(body.items) ? body.items : [];
    if (!customerId || items.length === 0) {
      return NextResponse.json(
        { detail: 'customer_id and at least one line item are required' },
        { status: 400 }
      );
    }

    const customerRow = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: scope.userId, isActive: true },
      select: { id: true },
    });
    if (!customerRow) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const lineData = await buildQuoteLinesFromItems(items, scope.userId);
    const total = lineData.reduce((s, l) => s + l.lineTotal, 0);
    const quoteNumber =
      body.quote_number && String(body.quote_number).trim()
        ? String(body.quote_number).trim()
        : await nextQuoteNumber(scope.userId);

    const validUntil =
      body.valid_until && String(body.valid_until).trim()
        ? new Date(String(body.valid_until))
        : null;

    const row = await prisma.quote.create({
      data: {
        ownerUserId: scope.userId,
        customerId,
        quoteNumber,
        status: String(body.status ?? 'draft'),
        total,
        validUntil: validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
        notes: body.notes != null ? String(body.notes) : null,
        lineItems: {
          create: lineData.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: { customer: { select: { companyName: true } }, _count: { select: { lineItems: true } } },
    });

    const { customer, _count, ...rest } = row;
    return NextResponse.json(
      {
        ...quoteToApi(rest, customer?.companyName),
        quote_date: row.createdAt.toISOString(),
        item_count: _count.lineItems,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
