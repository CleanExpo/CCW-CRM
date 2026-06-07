import { prisma } from '@/lib/db/prisma';
import { recordReconciliationAudit } from '@/lib/bank-reconciliation/audit';

export type XeroExportResult = {
  ok: boolean;
  export_ref: string | null;
  message: string;
  mode: 'live' | 'queued';
};

/**
 * Records a clean accounting export intent for a reconciled bank line.
 * Live Xero payment/journal API calls require connected workspace tokens.
 */
export async function exportReconciledFeedToXero(input: {
  feedTransactionId: string;
  performedBy: string;
}): Promise<XeroExportResult> {
  const feed = await prisma.bankFeedTransaction.findUnique({
    where: { id: input.feedTransactionId },
    include: {
      matchedInvoice: { include: { customer: true } },
      matchedPurchaseOrder: { include: { supplier: true } },
      allocations: true,
    },
  });

  if (!feed || !feed.reconciled) {
    return { ok: false, export_ref: null, message: 'Feed line is not reconciled', mode: 'queued' };
  }

  const exportRef = `XERO-REC-${feed.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
  const summary = feed.matchedInvoice
    ? `Payment for invoice ${feed.matchedInvoice.invoiceNumber}`
    : feed.matchedPurchaseOrder
      ? `Supplier payment PO ${feed.matchedPurchaseOrder.poNumber}`
      : feed.allocations.length > 0
        ? `Split reconciliation (${feed.allocations.length} lines)`
        : 'Bank reconciliation';

  const xeroMode = process.env.XERO_MODE?.trim() ?? 'demo';
  const status = xeroMode === 'live' ? 'queued' : 'exported';

  await prisma.bankFeedTransaction.update({
    where: { id: feed.id },
    data: {
      xeroExportStatus: status,
      xeroExportRef: exportRef,
    },
  });

  await recordReconciliationAudit({
    feedTransactionId: feed.id,
    action: 'export_xero',
    performedBy: input.performedBy,
    details: { export_ref: exportRef, summary, xero_mode: xeroMode },
  });

  if (xeroMode !== 'live') {
    return {
      ok: true,
      export_ref: exportRef,
      message: `${summary} — recorded for Xero export (demo mode)`,
      mode: 'queued',
    };
  }

  return {
    ok: true,
    export_ref: exportRef,
    message: `${summary} — queued for Xero export when connection is live`,
    mode: 'live',
  };
}
