import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderToApi } from '@/lib/db/api-serialize';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Prisma.OrderWhereInput = {};
    if (search) {
      where.orderNumber = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { customer: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const items = rows.map((o) => {
      const { customer, ...rest } = o;
      return orderToApi(rest, customer?.companyName);
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
    const row = await prisma.order.create({
      data: {
        customerId: String(body.customer_id ?? body.customerId ?? ''),
        orderNumber: String(body.order_number ?? body.orderNumber ?? ''),
        status: String(body.status ?? 'draft'),
        total: Number(body.total ?? 0),
      },
    });
    return NextResponse.json(orderToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
