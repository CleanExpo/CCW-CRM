import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { quoteToApi } from '@/lib/db/api-serialize';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Prisma.QuoteWhereInput = {};
    if (search) {
      where.quoteNumber = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: { customer: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.quote.count({ where }),
    ]);

    const items = rows.map((q) => {
      const { customer, ...rest } = q;
      return quoteToApi(rest, customer?.companyName);
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
    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.quote.create({
      data: {
        customerId: String(body.customer_id ?? body.customerId ?? ''),
        quoteNumber: String(body.quote_number ?? body.quoteNumber ?? ''),
        status: String(body.status ?? 'draft'),
        total: body.total != null ? Number(body.total) : null,
      },
    });
    return NextResponse.json(quoteToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
