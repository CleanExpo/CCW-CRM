/**
 * UNI-2106: SendGrid Event Webhook must not resolve messages using unscoped/fuzzy
 * matching. The webhook is authenticated only by a shared secret or ECDSA signature
 * (not a per-user session, and payload fields are attacker-influenceable), so any
 * lookup that isn't an exact match on the message's own id can let one tenant's event
 * (or a forged payload) mutate another tenant's email record.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    emailMessage: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    emailThread: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';
import { applySendGridEvent } from '../sendgrid-events';

describe('applySendGridEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fall back to an unscoped substring match on sg_message_id', async () => {
    const tenantAMessage = {
      id: 'msg-tenant-a',
      threadId: 'thread-tenant-a',
      sendgridMessageId: 'aaa111.filter001.abcde',
      deliveryStatus: 'pending',
      deliveryDetail: null,
    };

    vi.mocked(prisma.emailMessage.findUnique).mockResolvedValue(null as never);
    // Simulate a real Prisma equality (not `contains`) match: only an exact id
    // equal to the stored value resolves; a short/incidental substring ("111")
    // must NOT resolve to tenant A's message.
    vi.mocked(prisma.emailMessage.findFirst).mockImplementation(((args: unknown) => {
      const where = (args as { where?: { OR?: Array<{ sendgridMessageId?: string }> } })?.where;
      const candidates = where?.OR?.map((c) => c.sendgridMessageId) ?? [];
      if (candidates.includes('aaa111.filter001.abcde')) {
        return Promise.resolve(tenantAMessage);
      }
      return Promise.resolve(null);
    }) as never);

    const result = await applySendGridEvent({
      event: 'bounce',
      sg_message_id: '111',
      reason: 'mailbox full',
    });

    expect(prisma.emailMessage.update).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('does not trust an attacker-suppliable thread_id fallback to pick an arbitrary tenant thread', async () => {
    vi.mocked(prisma.emailMessage.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.emailMessage.findFirst).mockResolvedValue(null as never);

    const result = await applySendGridEvent({
      event: 'delivered',
      thread_id: 'thread-belonging-to-another-tenant',
      // no sg_message_id / message_id at all
    });

    // The thread_id-only fallback (no verified message/sg id) must not be used to
    // resolve and mutate an arbitrary tenant's message.
    expect(prisma.emailMessage.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ threadId: 'thread-belonging-to-another-tenant' }),
      })
    );
    expect(prisma.emailMessage.update).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('still applies events that exactly match a known sendgrid message id', async () => {
    const message = {
      id: 'msg-1',
      threadId: 'thread-1',
      sendgridMessageId: 'abc123.filter001.12345',
      deliveryStatus: 'pending',
      deliveryDetail: null,
    };

    vi.mocked(prisma.emailMessage.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.emailMessage.findFirst).mockResolvedValue(message as never);
    vi.mocked(prisma.emailMessage.update).mockResolvedValue({} as never);
    vi.mocked(prisma.emailThread.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await applySendGridEvent({
      event: 'delivered',
      sg_message_id: 'abc123.filter001.12345',
    });

    expect(result).toBe(true);
    expect(prisma.emailMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'msg-1' } })
    );
  });

  it('still applies events resolved by exact internal message_id', async () => {
    const message = {
      id: 'msg-2',
      threadId: 'thread-2',
      sendgridMessageId: null,
      deliveryStatus: 'pending',
      deliveryDetail: null,
    };
    vi.mocked(prisma.emailMessage.findUnique).mockResolvedValue(message as never);
    vi.mocked(prisma.emailMessage.update).mockResolvedValue({} as never);

    const result = await applySendGridEvent({
      event: 'open',
      message_id: 'msg-2',
    });

    expect(result).toBe(true);
    expect(prisma.emailMessage.findFirst).not.toHaveBeenCalled();
  });
});
