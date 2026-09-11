/**
 * UNI-2668 Phase 0c — money-path silent-success elimination.
 *
 * These tests exist to pin one rule: a billing function must never report
 * that money moved, or that a subscription is paid, unless it actually did
 * the work. Before the fix in this branch both assertions below failed —
 * `retryFailedPayment` flipped the subscription to `active` and returned
 * `{ success: true }` without any charge ever being attempted, and
 * `sendDunningLetter` returned `{ sent: true }` without sending mail.
 *
 * Prisma is mocked at the module boundary; nothing here touches a database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSubFindUnique = vi.fn();
const mockSubCreate = vi.fn();
const mockSubUpdate = vi.fn();
const mockMethodFindFirst = vi.fn();
const mockInvoiceFindFirst = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    workspaceSubscription: {
      findUnique: mockSubFindUnique,
      create: mockSubCreate,
      update: mockSubUpdate,
    },
    workspacePaymentMethod: { findFirst: mockMethodFindFirst },
    workspaceBillingInvoice: { findFirst: mockInvoiceFindFirst },
  },
}));

const { retryFailedPayment, sendDunningLetter } = await import('../workspace-billing');

const WORKSPACE = 'ws-1';

function pastDueSubscription() {
  return {
    workspaceId: WORKSPACE,
    tier: 'professional',
    status: 'past_due',
    billingInterval: 'monthly',
    priceCents: 24900,
    trialEndsAt: null,
    currentPeriodStart: new Date('2026-08-01'),
    currentPeriodEnd: new Date('2026-09-01'),
    lastPaymentFailedAt: new Date('2026-09-02'),
  };
}

describe('retryFailedPayment must not grant a paid subscription without charging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubFindUnique.mockResolvedValue(pastDueSubscription());
    mockMethodFindFirst.mockResolvedValue({ id: 'pm-1', isDefault: true });
  });

  it('does not report success when no charge was attempted', async () => {
    const result = await retryFailedPayment(WORKSPACE, 'pm-1');
    expect(result.success).toBe(false);
  });

  it('names itself as not implemented rather than inventing a reason', async () => {
    const result = await retryFailedPayment(WORKSPACE, 'pm-1');
    expect(result.reason).toMatch(/not implemented/i);
  });

  it('never writes status:active to the subscription', async () => {
    await retryFailedPayment(WORKSPACE, 'pm-1');
    const activeWrites = mockSubUpdate.mock.calls.filter(
      ([args]) => args?.data?.status === 'active',
    );
    expect(activeWrites).toEqual([]);
  });

  it('never clears the payment-failure marker, so dunning keeps running', async () => {
    await retryFailedPayment(WORKSPACE, 'pm-1');
    const clearedFailure = mockSubUpdate.mock.calls.filter(
      ([args]) => args?.data && 'lastPaymentFailedAt' in args.data && args.data.lastPaymentFailedAt === null,
    );
    expect(clearedFailure).toEqual([]);
  });

  it('never extends the billing period', async () => {
    await retryFailedPayment(WORKSPACE, 'pm-1');
    const extended = mockSubUpdate.mock.calls.filter(
      ([args]) => args?.data && ('currentPeriodEnd' in args.data || 'currentPeriodStart' in args.data),
    );
    expect(extended).toEqual([]);
  });

  it('still reports the pre-existing no-payment-method case distinctly', async () => {
    mockMethodFindFirst.mockResolvedValue(null);
    const result = await retryFailedPayment(WORKSPACE);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('No payment method on file');
  });
});

describe('sendDunningLetter must not report mail it did not send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubFindUnique.mockResolvedValue(pastDueSubscription());
    mockInvoiceFindFirst.mockResolvedValue({ id: 'inv-1', status: 'past_due' });
  });

  it('does not report sent:true', async () => {
    const result = await sendDunningLetter(WORKSPACE, 'inv-1');
    expect(result.sent).toBe(false);
  });

  it('names itself as not implemented', async () => {
    const result = await sendDunningLetter(WORKSPACE, 'inv-1');
    expect(result.reason).toMatch(/not implemented/i);
  });

  it('still reports the pre-existing no-invoice case distinctly', async () => {
    mockInvoiceFindFirst.mockResolvedValue(null);
    const result = await sendDunningLetter(WORKSPACE);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('No overdue billing invoice found');
  });
});
