import { prisma } from '@/lib/db/prisma';
import { recordReconciliationAudit } from '@/lib/bank-reconciliation/audit';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function applyBankMatch(input: {
  feedId: string;
  userId: string;
  targetType: 'invoice' | 'purchase_order' | 'pos_transaction' | 'transfer' | 'fee' | 'rule';
  targetId?: string;
  notes?: string;
}) {
  const ownerIds = await workspaceOwnerIds(input.userId);
  const feed = await prisma.bankFeedTransaction.findFirst({
    where: {
      id: input.feedId,
      reconciled: false,
      bankAccount: bankAccountOwnerFilter(ownerIds),
    },
  });
  if (!feed) throw new Error('Feed line not found');

  const data: {
    reconciled: boolean;
    status: string;
    reconciledBy: string;
    reconciledAt: Date;
    matchedInvoiceId?: string | null;
    matchedPurchaseOrderId?: string | null;
    matchedPosTxId?: string | null;
    suggestedAction?: string;
  } = {
    reconciled: true,
    status: 'reconciled',
    reconciledBy: input.userId,
    reconciledAt: new Date(),
    suggestedAction: input.targetType,
  };

  if (input.targetType === 'invoice' && input.targetId) {
    data.matchedInvoiceId = input.targetId;
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.targetId, ownerUserId: { in: ownerIds } },
    });
    if (!invoice) throw new Error('Invoice not found');
    const payAmt =
      (feed.credit != null && feed.credit > 0 ? feed.credit : null) ??
      (feed.debit != null ? feed.debit : 0);
    await prisma.$transaction([
      prisma.bankFeedTransaction.update({ where: { id: feed.id }, data }),
      prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          amount: payAmt ?? 0,
          paymentDate: feed.transactionDate,
          paymentMethod: 'bank_transfer',
          referenceNumber: feed.reference || feed.id.slice(0, 8),
          notes: input.notes ?? 'Bank reconciliation',
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: { increment: payAmt ?? 0 },
          status:
            invoice.amountPaid + (payAmt ?? 0) >= invoice.total - 0.01 ? 'paid' : 'partial',
        },
      }),
    ]);
  } else if (input.targetType === 'purchase_order' && input.targetId) {
    data.matchedPurchaseOrderId = input.targetId;
    await prisma.bankFeedTransaction.update({ where: { id: feed.id }, data });
  } else if (input.targetType === 'pos_transaction' && input.targetId) {
    data.matchedPosTxId = input.targetId;
    await prisma.$transaction([
      prisma.bankFeedTransaction.update({ where: { id: feed.id }, data }),
      prisma.posTransaction.update({
        where: { id: input.targetId },
        data: { reconciliationStatus: 'reconciled' },
      }),
    ]);
  } else {
    await prisma.bankFeedTransaction.update({ where: { id: feed.id }, data });
  }

  await recordReconciliationAudit({
    feedTransactionId: feed.id,
    action: 'approve_match',
    performedBy: input.userId,
    details: { target_type: input.targetType, target_id: input.targetId ?? null, notes: input.notes },
  });

  return feed.id;
}

export async function applySplitMatch(input: {
  feedId: string;
  userId: string;
  allocations: Array<{
    allocation_type: string;
    target_id?: string;
    amount: number;
    gst_category?: string;
    account_code?: string;
    notes?: string;
  }>;
}) {
  const ownerIds = await workspaceOwnerIds(input.userId);
  const feed = await prisma.bankFeedTransaction.findFirst({
    where: {
      id: input.feedId,
      reconciled: false,
      bankAccount: bankAccountOwnerFilter(ownerIds),
    },
  });
  if (!feed) throw new Error('Feed line not found');
  if (input.allocations.length === 0) throw new Error('At least one allocation required');

  await prisma.$transaction([
    prisma.bankReconciliationAllocation.createMany({
      data: input.allocations.map((a) => ({
        feedTransactionId: feed.id,
        allocationType: a.allocation_type,
        targetId: a.target_id ?? null,
        amount: a.amount,
        gstCategory: a.gst_category ?? null,
        accountCode: a.account_code ?? null,
        notes: a.notes ?? null,
      })),
    }),
    prisma.bankFeedTransaction.update({
      where: { id: feed.id },
      data: {
        reconciled: true,
        status: 'reconciled',
        suggestedAction: 'split',
        reconciledBy: input.userId,
        reconciledAt: new Date(),
      },
    }),
  ]);

  await recordReconciliationAudit({
    feedTransactionId: feed.id,
    action: 'split',
    performedBy: input.userId,
    details: { allocations: input.allocations },
  });

  return feed.id;
}

export async function flagFeedForReview(input: {
  feedId: string;
  userId: string;
  reason?: string;
}) {
  const ownerIds = await workspaceOwnerIds(input.userId);
  const feed = await prisma.bankFeedTransaction.findFirst({
    where: { id: input.feedId, bankAccount: bankAccountOwnerFilter(ownerIds) },
  });
  if (!feed) throw new Error('Feed line not found');

  await prisma.bankFeedTransaction.update({
    where: { id: feed.id },
    data: { reviewStatus: 'flagged', status: 'review' },
  });

  await recordReconciliationAudit({
    feedTransactionId: feed.id,
    action: 'flag_review',
    performedBy: input.userId,
    details: { reason: input.reason ?? null },
  });
}
