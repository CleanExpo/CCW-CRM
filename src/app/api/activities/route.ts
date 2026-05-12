import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmActivityToApi } from '@/lib/db/crm-serialize';
import type { Prisma } from '@prisma/client';

const ACTIVITY_TYPES = new Set(['call', 'email', 'meeting', 'note', 'task']);

const ACTIVITY_INCLUDE = {
  customer: { select: { companyName: true } },
  contact: { select: { firstName: true, lastName: true } },
  order: { select: { orderNumber: true } },
  quote: { select: { quoteNumber: true } },
} satisfies Prisma.CrmActivityInclude;

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const activityType = searchParams.get('activity_type')?.trim();
    const customerId = searchParams.get('customer_id')?.trim();
    const contactId = searchParams.get('contact_id')?.trim();
    const orderId = searchParams.get('order_id')?.trim();
    const quoteId = searchParams.get('quote_id')?.trim();
    const includeCompleted = searchParams.get('include_completed') !== 'false';

    const where: Prisma.CrmActivityWhereInput = {
      ownerUserId: { in: workspaceUserIds },
    };

    if (activityType) {
      if (!ACTIVITY_TYPES.has(activityType)) {
        return NextResponse.json({ detail: 'Invalid activity_type' }, { status: 400 });
      }
      where.activityType = activityType;
    }
    if (customerId) where.customerId = customerId;
    if (contactId) where.contactId = contactId;
    if (orderId) where.orderId = orderId;
    if (quoteId) where.quoteId = quoteId;

    if (!includeCompleted) {
      const incompleteTasks: Prisma.CrmActivityWhereInput = {
        OR: [{ activityType: { not: 'task' } }, { completedAt: null }],
      };
      const existingAnd = where.AND;
      where.AND = existingAnd
        ? Array.isArray(existingAnd)
          ? [...existingAnd, incompleteTasks]
          : [existingAnd, incompleteTasks]
        : [incompleteTasks];
    }

    const [rows, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where,
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crmActivity.count({ where }),
    ]);

    const data = rows.map((r) => {
      const { customer, contact, order, quote, ...a } = r;
      return crmActivityToApi(a, { customer, contact, order, quote });
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

    const activityType = String(body.activity_type ?? '').trim();
    if (!ACTIVITY_TYPES.has(activityType)) {
      return NextResponse.json({ detail: 'Invalid activity_type' }, { status: 400 });
    }

    const subject = String(body.subject ?? '').trim();
    if (!subject) {
      return NextResponse.json({ detail: 'subject is required' }, { status: 400 });
    }

    let customerId = (body.customer_id as string | undefined)?.trim() || null;
    const contactId = (body.contact_id as string | undefined)?.trim() || null;

    if (contactId) {
      const contact = await prisma.crmContact.findFirst({
        where: { id: contactId, ownerUserId: { in: workspaceUserIds } },
        select: { customerId: true },
      });
      if (!contact) {
        return NextResponse.json({ detail: 'Contact not found' }, { status: 400 });
      }
      if (!customerId && contact.customerId) {
        customerId = contact.customerId;
      }
    }

    if (customerId) {
      const ok = await prisma.customer.findFirst({
        where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
        select: { id: true },
      });
      if (!ok) {
        return NextResponse.json({ detail: 'Customer not found' }, { status: 400 });
      }
    }

    let orderId: string | null = (body.order_id as string | undefined)?.trim() || null;
    let quoteId: string | null = (body.quote_id as string | undefined)?.trim() || null;

    if (orderId) {
      const o = await prisma.order.findFirst({
        where: { id: orderId, ownerUserId: { in: workspaceUserIds } },
        select: { id: true },
      });
      if (!o) return NextResponse.json({ detail: 'Order not found' }, { status: 400 });
    }
    if (quoteId) {
      const q = await prisma.quote.findFirst({
        where: { id: quoteId, ownerUserId: { in: workspaceUserIds } },
        select: { id: true },
      });
      if (!q) return NextResponse.json({ detail: 'Quote not found' }, { status: 400 });
    }

    const dueRaw = body.due_date as string | undefined;
    const dueDate =
      dueRaw && activityType === 'task' && !Number.isNaN(Date.parse(dueRaw))
        ? new Date(dueRaw)
        : null;

    const created = await prisma.crmActivity.create({
      data: {
        ownerUserId: scope.userId,
        activityType,
        subject,
        description: (body.description as string)?.trim() || null,
        customerId,
        contactId,
        orderId,
        quoteId,
        dueDate,
        createdBy: scope.userId,
      },
      include: ACTIVITY_INCLUDE,
    });

    const { customer, contact, order, quote, ...a } = created;
    return NextResponse.json(crmActivityToApi(a, { customer, contact, order, quote }), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
