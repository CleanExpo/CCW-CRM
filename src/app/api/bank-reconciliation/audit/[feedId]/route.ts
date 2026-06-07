import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ feedId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { feedId } = await context.params;
    const ownerIds = await workspaceOwnerIds(scope.userId);

    const feed = await prisma.bankFeedTransaction.findFirst({
      where: { id: feedId, bankAccount: bankAccountOwnerFilter(ownerIds) },
    });
    if (!feed) {
      return NextResponse.json({ detail: 'Feed line not found' }, { status: 404 });
    }

    const entries = await prisma.bankReconciliationAudit.findMany({
      where: { feedTransactionId: feedId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      entries.map((e) => ({
        id: e.id,
        action: e.action,
        performed_by: e.performedBy,
        details: e.details,
        created_at: e.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
