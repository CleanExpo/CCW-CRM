import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmContactToApi } from '@/lib/db/crm-serialize';
import type { Prisma } from '@prisma/client';

const CONTACT_DETAIL_INCLUDE = {
  customer: { select: { companyName: true, ownerUserId: true } },
} satisfies Prisma.CrmContactInclude;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const row = await prisma.crmContact.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: CONTACT_DETAIL_INCLUDE,
    });
    if (!row) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    const { customer, ...c } = row;
    const inWs = customer && workspaceUserIds.includes(customer.ownerUserId);
    return NextResponse.json(crmContactToApi(c, inWs ? { companyName: customer.companyName } : null));
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

    const existing = await prisma.crmContact.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const customerIdRaw = body.customer_id !== undefined ? (body.customer_id as string | null) : undefined;
    let customerId = existing.customerId;
    if (customerIdRaw !== undefined) {
      customerId = customerIdRaw;
      if (customerId) {
        const cust = await prisma.customer.findFirst({
          where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
          select: { id: true },
        });
        if (!cust) {
          return NextResponse.json({ detail: 'Customer not found' }, { status: 400 });
        }
      }
    }

    const isPrimary =
      body.is_primary !== undefined ? Boolean(body.is_primary) : existing.isPrimary;

    const updated = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      if (isPrimary && customerId) {
        await tx.crmContact.updateMany({
          where: { customerId, ownerUserId: { in: workspaceUserIds }, NOT: { id } },
          data: { isPrimary: false },
        });
      }

      return tx.crmContact.update({
        where: { id },
        data: {
          ...(body.first_name !== undefined ? { firstName: String(body.first_name).trim() } : {}),
          ...(body.last_name !== undefined ? { lastName: String(body.last_name).trim() } : {}),
          ...(body.email !== undefined ? { email: (body.email as string)?.trim() || null } : {}),
          ...(body.phone !== undefined ? { phone: (body.phone as string)?.trim() || null } : {}),
          ...(body.mobile !== undefined ? { mobile: (body.mobile as string)?.trim() || null } : {}),
          ...(body.job_title !== undefined ? { jobTitle: (body.job_title as string)?.trim() || null } : {}),
          ...(body.department !== undefined
            ? { department: (body.department as string)?.trim() || null }
            : {}),
          ...(body.notes !== undefined ? { notes: (body.notes as string)?.trim() || null } : {}),
          ...(body.is_active !== undefined ? { isActive: Boolean(body.is_active) } : {}),
          ...(body.customer_id !== undefined ? { customerId } : {}),
          ...(body.is_primary !== undefined ? { isPrimary } : {}),
        },
        include: CONTACT_DETAIL_INCLUDE,
      });
    });

    const { customer, ...c } = updated;
    const inWs = customer && workspaceUserIds.includes(customer.ownerUserId);
    return NextResponse.json(crmContactToApi(c, inWs ? { companyName: customer.companyName } : null));
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

    const existing = await prisma.crmContact.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    await prisma.crmContact.update({
      where: { id },
      data: { isActive: false },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
