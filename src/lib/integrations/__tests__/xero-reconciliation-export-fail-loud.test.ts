/**
 * UNI-2668 Phase 0c — money-path silent-success elimination.
 *
 * `exportReconciledFeedToXero` contains no `fetch(` call. Before the fix in
 * this branch, when the Xero mode was 'live' and a workspace connection held
 * an access token, it returned `mode: 'live'` with the message "recorded
 * against Xero tenant …" and wrote `xeroExportStatus: 'exported'` to the
 * database — all without contacting Xero. These tests pin that a code path
 * which makes no API call may not report that an export happened.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFeedFindUnique = vi.fn();
const mockFeedUpdate = vi.fn();
const mockRecordAudit = vi.fn();
const mockGetXeroMode = vi.fn();
const mockGetWorkspaceIdForUser = vi.fn();
const mockLoadConnection = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    bankFeedTransaction: { findUnique: mockFeedFindUnique, update: mockFeedUpdate },
  },
}));
vi.mock('@/lib/bank-reconciliation/audit', () => ({ recordReconciliationAudit: mockRecordAudit }));
vi.mock('@/lib/integrations/xero', () => ({ getXeroMode: mockGetXeroMode }));
vi.mock('@/lib/auth/workspace-scope', () => ({ getWorkspaceIdForUser: mockGetWorkspaceIdForUser }));
vi.mock('@/lib/integrations/xero-storage', () => ({ loadWorkspaceXeroConnection: mockLoadConnection }));

const { exportReconciledFeedToXero } = await import('../xero-reconciliation-export');

const INPUT = { feedTransactionId: 'feed-1', performedBy: 'user-1' };

function reconciledFeed() {
  return {
    id: 'feed-1',
    reconciled: true,
    matchedInvoice: { invoiceNumber: 'INV-100', customer: { id: 'c1' } },
    matchedPurchaseOrder: null,
    allocations: [],
  };
}

describe('exportReconciledFeedToXero with a live connection but no API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedFindUnique.mockResolvedValue(reconciledFeed());
    mockGetXeroMode.mockReturnValue('live');
    mockGetWorkspaceIdForUser.mockResolvedValue('ws-1');
    mockLoadConnection.mockResolvedValue({
      accessToken: 'token-present',
      tenantId: 'tenant-1',
      tenantName: 'CCW Pty Ltd',
    });
  });

  it('does not claim mode:live when nothing was sent to Xero', async () => {
    const result = await exportReconciledFeedToXero(INPUT);
    expect(result.mode).toBe('queued');
  });

  it('does not claim the line was recorded against a Xero tenant', async () => {
    const result = await exportReconciledFeedToXero(INPUT);
    expect(result.message).not.toMatch(/recorded against Xero tenant/i);
  });

  it('says plainly that the export is queued and not yet sent', async () => {
    const result = await exportReconciledFeedToXero(INPUT);
    expect(result.message).toMatch(/not (yet )?sent|queued/i);
  });

  it('never writes xeroExportStatus:exported', async () => {
    await exportReconciledFeedToXero(INPUT);
    const exportedWrites = mockFeedUpdate.mock.calls.filter(
      ([args]) => args?.data?.xeroExportStatus === 'exported',
    );
    expect(exportedWrites).toEqual([]);
  });

  it('still records the export intent in the audit trail', async () => {
    await exportReconciledFeedToXero(INPUT);
    expect(mockRecordAudit).toHaveBeenCalledTimes(1);
  });

  it('still rejects an unreconciled line the way it always did', async () => {
    mockFeedFindUnique.mockResolvedValue({ ...reconciledFeed(), reconciled: false });
    const result = await exportReconciledFeedToXero(INPUT);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Feed line is not reconciled');
  });
});

describe('exportReconciledFeedToXero in demo mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedFindUnique.mockResolvedValue(reconciledFeed());
    mockGetXeroMode.mockReturnValue('demo');
  });

  it('does not write xeroExportStatus:exported in demo mode either', async () => {
    await exportReconciledFeedToXero(INPUT);
    const exportedWrites = mockFeedUpdate.mock.calls.filter(
      ([args]) => args?.data?.xeroExportStatus === 'exported',
    );
    expect(exportedWrites).toEqual([]);
  });
});
