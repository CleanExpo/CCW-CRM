import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmContactToApi } from '@/lib/db/crm-serialize';
import type { Prisma } from '@prisma/client';

const CONTACT_LIST_INCLUDE = {
  customer: { select: { companyName: true, ownerUserId: true } },
} satisfies Prisma.CrmContactInclude;

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const search = searchParams.get('search')?.trim();
    const customerId = searchParams.get('customer_id')?.trim();
    const activeOnly = searchParams.get('is_active');

    const where: Prisma.CrmContactWhereInput = {
      ownerUserId: { in: workspaceUserIds },
    };

    if (customerId) {
      where.customerId = customerId;
    }
    if (activeOnly === 'true') {
      where.isActive = true;
    } else if (activeOnly === 'false') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.crmContact.findMany({
        where,
        include: CONTACT_LIST_INCLUDE,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crmContact.count({ where }),
    ]);

    const data = rows.map((r: typeof rows[number]) => {
      const { customer, ...rest } = r;
      const inWs = customer && workspaceUserIds.includes(customer.ownerUserId);
      return crmContactToApi(rest, inWs ? { companyName: customer.companyName } : null);
    });

    return NextResponse.json({
      data,
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

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const body = (await request.json()) as Record<string, unknown>;

    const customerIdRaw = body.customer_id as string | undefined | null;
    if (customerIdRaw) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerIdRaw, ownerUserId: { in: workspaceUserIds } },
        select: { id: true },
      });
      if (!cust) {
        return NextResponse.json({ detail: 'Customer not found' }, { status: 400 });
      }
    }

    const isPrimary = Boolean(body.is_primary);
    const customerId = customerIdRaw || null;

    const created = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      if (isPrimary && customerId) {
        await tx.crmContact.updateMany({
          where: { customerId, ownerUserId: { in: workspaceUserIds } },
          data: { isPrimary: false },
        });
      }

      return tx.crmContact.create({
        data: {
          ownerUserId: scope.userId,
          customerId,
          firstName: String(body.first_name ?? '').trim(),
          lastName: String(body.last_name ?? '').trim(),
          email: (body.email as string)?.trim() || null,
          phone: (body.phone as string)?.trim() || null,
          mobile: (body.mobile as string)?.trim() || null,
          jobTitle: (body.job_title as string)?.trim() || null,
          department: (body.department as string)?.trim() || null,
          notes: (body.notes as string)?.trim() || null,
          isPrimary,
          isActive: body.is_active !== false,
        },
      });
    });

    return NextResponse.json(crmContactToApi(created), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
