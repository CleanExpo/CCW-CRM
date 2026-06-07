import { prisma } from '@/lib/db/prisma';

export async function recordReconciliationAudit(input: {
  feedTransactionId: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}) {
  return prisma.bankReconciliationAudit.create({
    data: {
      feedTransactionId: input.feedTransactionId,
      action: input.action,
      performedBy: input.performedBy,
      details: (input.details ?? {}) as object,
    },
  });
}
