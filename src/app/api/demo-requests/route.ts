import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';

function rowToApi(r: {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  preferredDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    company_name: r.company ?? '',
    contact_name: r.name,
    email: r.email,
    phone: r.phone ?? '',
    product_interest: null as string | null,
    preferred_date: r.preferredDate?.toISOString() ?? null,
    notes: r.message ?? null,
    status: r.status as 'pending' | 'scheduled' | 'completed' | 'cancelled',
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '10');
    const statusFilter = searchParams.get('status_filter');
    const search = searchParams.get('search');

    const where: Prisma.DemoRequestWhereInput = {};
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.demoRequest.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(rowToApi),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
