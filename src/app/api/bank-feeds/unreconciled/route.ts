import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { feedAmountFromRow } from '@/lib/bank-reconciliation/match-suggestions';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const reviewOnly = searchParams.get('review_only') === 'true';

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const rows = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        ...(reviewOnly ? { reviewStatus: 'flagged' } : {}),
        ...(accountId ? { bankAccountId: accountId } : {}),
        bankAccount: bankAccountOwnerFilter(ownerIds),
      },
      include: { bankAccount: { select: { accountName: true } } },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        bank_account_id: r.bankAccountId,
        bank_account_name: r.bankAccount.accountName,
        transaction_date: r.transactionDate.toISOString(),
        description: r.description,
        raw_narration: r.rawNarration,
        reference: r.reference || '',
        credit: r.credit,
        debit: r.debit,
        amount: feedAmountFromRow(r),
        balance: r.balance,
        status: r.status,
        review_status: r.reviewStatus,
        suggested_action: r.suggestedAction,
        confidence_score: r.confidenceScore,
        confidence_reason: r.confidenceReason,
        gst_category: r.gstCategory,
        account_category: r.accountCategory,
        xero_export_status: r.xeroExportStatus,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
