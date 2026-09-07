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

  // UNI-2668: this module makes no HTTP call to Xero — there is no `fetch(`
  // anywhere in it. It previously wrote `xeroExportStatus: 'exported'` and
  // returned "recorded against Xero tenant …", so the ledger and the operator
  // both believed a reconciled line had reached the accounting system. Until a
  // real Xero payment/journal client exists, every path is `queued` and says so.
  const xeroMode = getXeroMode();
  const status = 'queued';
  let liveMessage = `${summary} — queued for Xero export; not yet sent (no Xero export client is wired)`;

  if (xeroMode === 'live') {
    const workspaceId = await getWorkspaceIdForUser(input.performedBy);
    const connection = workspaceId ? await loadWorkspaceXeroConnection(workspaceId) : null;
    if (connection?.accessToken) {
      liveMessage = `${summary} — queued for Xero tenant ${connection.tenantName ?? connection.tenantId}; not yet sent (no Xero export client is wired)`;
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
      message: `${summary} — queued for Xero export (demo mode); not yet sent`,
      mode: 'queued',
    };
  }

  return {
    ok: true,
    export_ref: exportRef,
    message: liveMessage,
    mode: 'queued',
  };
}
