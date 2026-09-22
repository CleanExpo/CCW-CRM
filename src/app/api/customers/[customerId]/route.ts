import { customerToApi } from '@/lib/db/api-serialize';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { customerId } = await context.params;
    const row = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(customerToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { customerId } = await context.params;
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.customer.update({
      where: { id: customerId },
      data: {
        companyName:
          body.company_name !== undefined
            ? String(body.company_name)
            : body.companyName !== undefined
              ? String(body.companyName)
              : undefined,
        contactName:
          body.contact_name !== undefined
            ? (body.contact_name as string | null)
            : body.contactName !== undefined
              ? (body.contactName as string | null)
              : undefined,
        email: body.email !== undefined ? (body.email as string | null) : undefined,
        city: body.city !== undefined ? (body.city as string | null) : undefined,
      },
    });
    return NextResponse.json(customerToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
