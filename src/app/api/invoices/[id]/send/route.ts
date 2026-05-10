import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const existing = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ detail: 'Only draft invoices can be marked sent' }, { status: 400 });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'sent' },
      include: {
        customer: { select: { companyName: true, email: true } },
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    const status = deriveInvoiceStatus(updated);
    return NextResponse.json(invoiceToApi(updated, { statusOverride: status }));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
