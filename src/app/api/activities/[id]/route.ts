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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const row = await prisma.crmActivity.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: ACTIVITY_INCLUDE,
    });
    if (!row) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    const { customer, contact, order, quote, ...a } = row;
    return NextResponse.json(crmActivityToApi(a, { customer, contact, order, quote }));
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

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const existing = await prisma.crmActivity.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const activityType =
      body.activity_type !== undefined
        ? String(body.activity_type).trim()
        : existing.activityType;
    if (!ACTIVITY_TYPES.has(activityType)) {
      return NextResponse.json({ detail: 'Invalid activity_type' }, { status: 400 });
    }

    let customerId = existing.customerId;
    if (body.customer_id !== undefined) {
      const raw = (body.customer_id as string | null)?.trim();
      customerId = raw || null;
      if (customerId) {
        const ok = await prisma.customer.findFirst({
          where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
          select: { id: true },
        });
        if (!ok) return NextResponse.json({ detail: 'Customer not found' }, { status: 400 });
      }
    }

    let contactId = existing.contactId;
    if (body.contact_id !== undefined) {
      const raw = (body.contact_id as string | null)?.trim();
      contactId = raw || null;
      if (contactId) {
        const c = await prisma.crmContact.findFirst({
          where: { id: contactId, ownerUserId: { in: workspaceUserIds } },
          select: { id: true, customerId: true },
        });
        if (!c) return NextResponse.json({ detail: 'Contact not found' }, { status: 400 });
        if (!customerId && c.customerId) customerId = c.customerId;
      }
    }

    let orderId = existing.orderId;
    if (body.order_id !== undefined) {
      const raw = (body.order_id as string | null)?.trim();
      orderId = raw || null;
      if (orderId) {
        const o = await prisma.order.findFirst({
          where: { id: orderId, ownerUserId: { in: workspaceUserIds } },
          select: { id: true },
        });
        if (!o) return NextResponse.json({ detail: 'Order not found' }, { status: 400 });
      }
    }

    let quoteId = existing.quoteId;
    if (body.quote_id !== undefined) {
      const raw = (body.quote_id as string | null)?.trim();
      quoteId = raw || null;
      if (quoteId) {
        const q = await prisma.quote.findFirst({
          where: { id: quoteId, ownerUserId: { in: workspaceUserIds } },
          select: { id: true },
        });
        if (!q) return NextResponse.json({ detail: 'Quote not found' }, { status: 400 });
      }
    }

    let dueDate = existing.dueDate;
    if (body.due_date !== undefined) {
      const raw = body.due_date as string | null | undefined;
      if (!raw || raw === '') {
        dueDate = null;
      } else if (!Number.isNaN(Date.parse(raw))) {
        dueDate = new Date(raw);
      }
    }

    const updated = await prisma.crmActivity.update({
      where: { id },
      data: {
        activityType,
        ...(body.subject !== undefined ? { subject: String(body.subject).trim() } : {}),
        ...(body.description !== undefined
          ? { description: (body.description as string)?.trim() || null }
          : {}),
        customerId,
        contactId,
        orderId,
        quoteId,
        dueDate,
      },
      include: ACTIVITY_INCLUDE,
    });

    const { customer, contact, order, quote, ...a } = updated;
    return NextResponse.json(crmActivityToApi(a, { customer, contact, order, quote }));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const existing = await prisma.crmActivity.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    await prisma.crmActivity.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
