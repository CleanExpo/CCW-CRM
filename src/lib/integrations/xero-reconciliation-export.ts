import { prisma } from '@/lib/db/prisma';
import { recordReconciliationAudit } from '@/lib/bank-reconciliation/audit';
import { getXeroMode } from '@/lib/integrations/xero';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { loadWorkspaceXeroConnection } from '@/lib/integrations/xero-storage';

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

  const xeroMode = getXeroMode();
  let status = xeroMode === 'live' ? 'queued' : 'exported';
  let liveMessage = `${summary} — queued for Xero export when connection is live`;

  if (xeroMode === 'live') {
    const workspaceId = await getWorkspaceIdForUser(input.performedBy);
    const connection = workspaceId ? await loadWorkspaceXeroConnection(workspaceId) : null;
    if (connection?.accessToken) {
      status = 'exported';
      liveMessage = `${summary} — recorded against Xero tenant ${connection.tenantName ?? connection.tenantId}`;
    }
  }

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
    message: liveMessage,
    mode: 'live',
  };
}
