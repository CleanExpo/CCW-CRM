import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { customerToApi } from '@/lib/db/api-serialize';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const cin7ContactType = searchParams.get('cin7_contact_type');

    const where: Prisma.CustomerWhereInput = {
      isActive: true,
      ownerUserId: { in: workspaceUserIds },
    };
    if (cin7ContactType) {
      where.cin7ContactType = { equals: cin7ContactType, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(customerToApi),
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

    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.customer.create({
      data: {
        ownerUserId: scope.userId,
        companyName: String(body.company_name ?? body.companyName ?? ''),
        contactName: (body.contact_name ?? body.contactName) as string | null | undefined,
        email: (body.email as string) ?? null,
        phone: (body.phone as string) ?? null,
        city: (body.city as string) ?? null,
        isActive: (body.is_active as boolean) ?? (body.isActive as boolean) ?? true,
      },
    });
    return NextResponse.json(customerToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
