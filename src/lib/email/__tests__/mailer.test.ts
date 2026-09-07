/**
 * UNI-2671 A1/A3: the mailer must never report a send it did not make.
 *
 * Every test here is a negative control on that one claim: an unconfigured
 * environment, a disabled flag, a provider that rejects, and a provider that
 * fails transiently must each produce something a caller CANNOT mistake for a
 * delivered email — and each must leave a receipt saying so.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// `vi.mock` is hoisted above the module body, so the mock it closes over has to
// be hoisted with it. Declaring it as a plain const fails at import time.
const prismaMock = vi.hoisted(() => ({
  transactionalEmail: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

import { sendTransactionalEmail, runEmailQueue, hashRecipient } from '../mailer';
import { buildPasswordResetEmail } from '../templates';
import type { EmailConfig } from '../config';
import type { MailTransport, TransportResult } from '../transport';

const EMAIL = buildPasswordResetEmail({
  resetUrl: 'https://optix.ccwarehouse.com.au/reset-password?token=t',
  expiresInMinutes: 60,
});

const CONFIGURED: EmailConfig = {
  status: 'configured',
  enabled: true,
  apiKey: 'not-a-key',
  from: 'noreply@optix.ccwarehouse.com.au',
  fromName: 'CC Warehouse Optix',
  replyTo: null,
  sandbox: false,
};

function transportReturning(result: TransportResult): MailTransport {
  return {
    name: 'test',
    send: vi.fn().mockResolvedValue(result),
    verifyCredentials: vi.fn().mockResolvedValue(true),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transactionalEmail.create.mockResolvedValue({ id: 'receipt-1' });
  prismaMock.transactionalEmail.update.mockResolvedValue({});
  prismaMock.transactionalEmail.findUnique.mockResolvedValue({ maxAttempts: 5 });
});

describe('fail-closed configuration', () => {
  it('refuses — and does not call the transport — when unconfigured', async () => {
    const transport = transportReturning({
      accepted: true,
      providerMessageId: 'should-never-happen',
      sandboxed: false,
    });

    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: {
        status: 'unconfigured',
        enabled: false,
        missing: ['SENDGRID_API_KEY', 'EMAIL_FROM'],
        reason: 'not configured',
      },
      transport,
    });

    expect(outcome.status).toBe('refused');
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('refuses when configured but EMAIL_ENABLED is off', async () => {
    const transport = transportReturning({
      accepted: true,
      providerMessageId: 'should-never-happen',
      sandboxed: false,
    });

    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: { ...CONFIGURED, enabled: false },
      transport,
    });

    expect(outcome.status).toBe('refused');
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('writes a receipt for a refusal, so a refusal is not a silence', async () => {
    await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: { ...CONFIGURED, enabled: false },
      transport: transportReturning({
        accepted: false,
        kind: 'permanent',
        status: 400,
        detail: 'x',
      }),
    });

    expect(prismaMock.transactionalEmail.create).toHaveBeenCalledTimes(1);
    const written = prismaMock.transactionalEmail.create.mock.calls[0][0].data;
    expect(written.status).toBe('refused');
    // A terminal row keeps no plaintext address.
    expect(written.recipientEmail).toBeNull();
  });
});

describe('a send is only "sent" when the provider accepted it', () => {
  it('reports sent and records the provider id on acceptance', async () => {
    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport: transportReturning({
        accepted: true,
        providerMessageId: 'sg-123',
        sandboxed: false,
      }),
    });

    expect(outcome).toMatchObject({ status: 'sent', providerMessageId: 'sg-123' });
    const update = prismaMock.transactionalEmail.update.mock.calls[0][0].data;
    expect(update.status).toBe('sent');
    expect(update.providerMessageId).toBe('sg-123');
    expect(update.recipientEmail).toBeNull();
  });

  it('reports failed — never sent — on a permanent provider rejection', async () => {
    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport: transportReturning({
        accepted: false,
        kind: 'permanent',
        status: 403,
        detail: 'The from address does not match a verified Sender Identity',
      }),
    });

    expect(outcome.status).toBe('failed');
    expect(prismaMock.transactionalEmail.update.mock.calls[0][0].data.status).toBe('failed');
  });

  it('queues a retry with a future attempt time on a transient failure', async () => {
    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport: transportReturning({
        accepted: false,
        kind: 'transient',
        status: 503,
        detail: 'service unavailable',
      }),
    });

    expect(outcome.status).toBe('queued');
    if (outcome.status !== 'queued') throw new Error('unreachable');
    expect(outcome.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    const update = prismaMock.transactionalEmail.update.mock.calls[0][0].data;
    expect(update.status).toBe('pending');
    expect(update.attempts).toBe(1);
  });

  it('stops retrying once maxAttempts is reached', async () => {
    prismaMock.transactionalEmail.findUnique.mockResolvedValue({ maxAttempts: 1 });

    const outcome = await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport: transportReturning({
        accepted: false,
        kind: 'transient',
        status: 503,
        detail: 'service unavailable',
      }),
    });

    expect(outcome.status).toBe('failed');
  });

  it('creates the receipt already due, so a crashed send is recoverable', async () => {
    // Regression: an earlier revision created the row with nextAttemptAt null.
    // The queue only claims rows with a non-null nextAttemptAt, so a process
    // that died mid-send left the receipt stranded in `pending` forever —
    // holding the plaintext recipient address it should eventually drop.
    await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport: transportReturning({
        accepted: true,
        providerMessageId: 'sg-1',
        sandboxed: false,
      }),
    });

    const created = prismaMock.transactionalEmail.create.mock.calls[0][0].data;
    expect(created.status).toBe('pending');
    expect(created.nextAttemptAt).toBeInstanceOf(Date);
    // Far enough out that the queue cannot race a send that is merely slow.
    expect(created.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
  });

  it('writes the receipt before the provider is called', async () => {
    const order: string[] = [];
    prismaMock.transactionalEmail.create.mockImplementation(async () => {
      order.push('receipt');
      return { id: 'receipt-1' };
    });
    const transport: MailTransport = {
      name: 'test',
      send: vi.fn().mockImplementation(async () => {
        order.push('send');
        return { accepted: true, providerMessageId: 'sg-1', sandboxed: false };
      }),
      verifyCredentials: vi.fn().mockResolvedValue(true),
    };

    await sendTransactionalEmail({
      to: 'someone@example.com',
      email: EMAIL,
      config: CONFIGURED,
      transport,
    });

    expect(order).toEqual(['receipt', 'send']);
  });
});

describe('recipient hashing', () => {
  it('is stable and case-insensitive', () => {
    expect(hashRecipient('Sam@Example.com ')).toBe(hashRecipient('sam@example.com'));
  });

  it('does not contain the address', () => {
    const hash = hashRecipient('sam@example.com');
    expect(hash).not.toContain('sam');
    expect(hash).toHaveLength(64);
  });
});

describe('queue runs report why they did not run', () => {
  it('says skipped, not zero, when unconfigured', async () => {
    const summary = await runEmailQueue({
      config: {
        status: 'unconfigured',
        enabled: false,
        missing: ['SENDGRID_API_KEY'],
        reason: 'not configured',
      },
    });
    expect(summary.skipped).toBeDefined();
    expect(prismaMock.transactionalEmail.findMany).not.toHaveBeenCalled();
  });

  it('says skipped when EMAIL_ENABLED is off', async () => {
    const summary = await runEmailQueue({ config: { ...CONFIGURED, enabled: false } });
    expect(summary.skipped).toContain('EMAIL_ENABLED');
  });

  it('reports an empty queue as ran-with-nothing-due, distinct from skipped', async () => {
    prismaMock.transactionalEmail.findMany.mockResolvedValue([]);
    const summary = await runEmailQueue({
      config: CONFIGURED,
      transport: transportReturning({
        accepted: true,
        providerMessageId: 'x',
        sandboxed: false,
      }),
    });
    expect(summary.skipped).toBeUndefined();
    expect(summary.claimed).toBe(0);
  });

  it('retries a due row and counts the outcome', async () => {
    prismaMock.transactionalEmail.findMany.mockResolvedValue([
      {
        id: 'receipt-9',
        template: 'password-reset',
        subject: 'Reset your Optix password',
        bodyText: 'text',
        bodyHtml: '<p>html</p>',
        recipientEmail: 'someone@example.com',
        attempts: 1,
      },
    ]);

    const summary = await runEmailQueue({
      config: CONFIGURED,
      transport: transportReturning({
        accepted: true,
        providerMessageId: 'sg-retry',
        sandboxed: false,
      }),
    });

    expect(summary).toMatchObject({ claimed: 1, sent: 1, queued: 0, failed: 0 });
  });

  it('leases a claimed row before attempting it, so two ticks cannot send it twice', async () => {
    // `now` here is the batch-start time the queue was given, and it is
    // deliberately in the past: the lease must be measured from the moment the
    // row is CLAIMED, not from when the batch began. A batch of 50 rows each
    // hitting the 15-second transport timeout runs for over twelve minutes, so
    // a lease anchored to the batch start would be expired for the later rows
    // and a concurrent tick could double-send them.
    const now = new Date(Date.now() - 60 * 60_000);
    prismaMock.transactionalEmail.findMany.mockResolvedValue([
      {
        id: 'receipt-9',
        template: 'password-reset',
        subject: 'Reset your Optix password',
        bodyText: 'text',
        bodyHtml: '<p>html</p>',
        recipientEmail: 'someone@example.com',
        attempts: 1,
      },
    ]);

    await runEmailQueue({
      config: CONFIGURED,
      now,
      transport: transportReturning({
        accepted: true,
        providerMessageId: 'sg-retry',
        sandboxed: false,
      }),
    });

    // First update is the lease, pushing the due time out of reach of a
    // concurrent tick. The send outcome is written after it.
    const lease = prismaMock.transactionalEmail.update.mock.calls[0][0];
    expect(lease.where.id).toBe('receipt-9');
    // Measured from real now, not from the hour-old batch-start time.
    expect(lease.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
  });
});
