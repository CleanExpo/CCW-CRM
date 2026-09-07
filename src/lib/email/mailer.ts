/**
 * The transactional mailer (UNI-2671 A1 + A3).
 *
 * One rule governs every branch below: **a caller is never told a message was
 * sent unless the provider accepted it.** The states a caller can be given are
 *
 *   sent     — the provider accepted it and returned an id
 *   queued   — the attempt failed transiently; a retry is scheduled and a
 *              receipt row exists in `pending`
 *   failed   — the provider refused it, or the attempts are exhausted
 *   refused  — email is not configured or not enabled, so nothing was attempted
 *
 * `refused` is deliberately not an error the caller can mistake for success.
 * It is what an un-provisioned deployment gets, and it is the honest answer to
 * the state Optix has actually been in since July.
 *
 * A receipt row is written BEFORE the provider is called, so a process that
 * dies mid-send leaves evidence rather than silence.
 */

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { resolveEmailConfig, type EmailConfig } from '@/lib/email/config';
import { createSendGridTransport } from '@/lib/email/providers/sendgrid';
import type { MailTransport } from '@/lib/email/transport';
import type { RenderedEmail } from '@/lib/email/templates/layout';

export type SendOutcome =
  | { status: 'sent'; receiptId: string; providerMessageId: string; sandboxed: boolean }
  | { status: 'queued'; receiptId: string; reason: string; nextAttemptAt: Date }
  | { status: 'failed'; receiptId: string; reason: string }
  | { status: 'refused'; receiptId: string | null; reason: string };

/** Terminal states. A row in one of these is never picked up by the queue again. */
const TERMINAL = new Set(['sent', 'failed', 'refused']);

/** Backoff schedule in minutes, indexed by attempt number (1-based). */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

/**
 * How long a receipt may sit in `pending` before the queue assumes the process
 * that created it died.
 *
 * A receipt is written before the provider call, which is the point — a crash
 * mid-send leaves evidence. But evidence is not enough on its own: an earlier
 * revision created the row with `nextAttemptAt: null`, and the queue only claims
 * rows with a non-null `nextAttemptAt`, so a crashed send was stranded in
 * `pending` forever while still holding the plaintext recipient address. It
 * looked like a queued message and was in fact an abandoned one.
 *
 * So every receipt is born already due at now + this margin. The margin has to
 * exceed the transport timeout by enough that the queue never races a send that
 * is simply slow: the request timeout is 15 seconds, and the first attempt
 * rewrites `nextAttemptAt` the moment it resolves either way.
 */
const STALLED_ATTEMPT_MINUTES = 15;

export function hashRecipient(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function backoffFor(attempt: number, now: Date): Date {
  const minutes = BACKOFF_MINUTES[Math.min(attempt, BACKOFF_MINUTES.length) - 1];
  return new Date(now.getTime() + minutes * 60_000);
}

/** Build the live transport for a configured environment. */
export function transportFor(config: EmailConfig): MailTransport | null {
  if (config.status !== 'configured') return null;
  return createSendGridTransport({
    apiKey: config.apiKey,
    from: config.from,
    fromName: config.fromName,
    replyTo: config.replyTo,
    sandbox: config.sandbox,
  });
}

export type SendTransactionalEmailInput = {
  to: string;
  email: RenderedEmail;
  /** Overrides for tests. Production passes neither. */
  config?: EmailConfig;
  transport?: MailTransport;
};

/**
 * Send one transactional email, recording a receipt either way.
 *
 * Callers should treat every non-`sent` outcome as "the recipient has not been
 * told". In particular `queued` means the user has NOT received their reset
 * link yet, and a UI that says otherwise is lying on this function's behalf.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput
): Promise<SendOutcome> {
  const config = input.config ?? resolveEmailConfig();
  const { to, email } = input;

  // Fail closed BEFORE writing a receipt for an attempt that cannot happen.
  if (config.status === 'unconfigured') {
    const receipt = await recordRefusal(to, email, config.reason);
    return { status: 'refused', receiptId: receipt, reason: config.reason };
  }
  if (!config.enabled) {
    const reason =
      'Transactional email is configured but EMAIL_ENABLED is not "true", so sending is switched off. Nothing was sent.';
    const receipt = await recordRefusal(to, email, reason);
    return { status: 'refused', receiptId: receipt, reason };
  }

  const transport = input.transport ?? transportFor(config);
  if (!transport) {
    const reason = 'No mail transport is available for the current configuration.';
    const receipt = await recordRefusal(to, email, reason);
    return { status: 'refused', receiptId: receipt, reason };
  }

  // The receipt exists before the network call, so a crash mid-send is visible —
  // and `nextAttemptAt` is set here so it is also RECOVERABLE. Without it the
  // queue could never claim the row again.
  const receipt = await prisma.transactionalEmail.create({
    data: {
      template: email.template,
      recipientHash: hashRecipient(to),
      recipientEmail: to,
      subject: email.subject,
      bodyText: email.text,
      bodyHtml: email.html,
      status: 'pending',
      nextAttemptAt: new Date(Date.now() + STALLED_ATTEMPT_MINUTES * 60_000),
      provider: transport.name,
      sandboxed: config.sandbox,
    },
    select: { id: true },
  });

  return attemptSend(receipt.id, to, email, transport, 0);
}

/** A refusal is still a receipt: the row proves the attempt was declined, not lost. */
async function recordRefusal(
  to: string,
  email: RenderedEmail,
  reason: string
): Promise<string | null> {
  try {
    const row = await prisma.transactionalEmail.create({
      data: {
        template: email.template,
        recipientHash: hashRecipient(to),
        // No plaintext address is retained on a terminal row.
        recipientEmail: null,
        subject: email.subject,
        status: 'refused',
        lastError: reason,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    // The refusal itself must still reach the caller even if the database is
    // unavailable; losing the receipt must not turn a refusal into a silence.
    console.error('[email] failed to record refusal receipt', error);
    return null;
  }
}

/** One attempt against the transport, with the receipt updated to match reality. */
async function attemptSend(
  receiptId: string,
  to: string,
  email: RenderedEmail,
  transport: MailTransport,
  priorAttempts: number
): Promise<SendOutcome> {
  const attempt = priorAttempts + 1;
  const now = new Date();

  const result = await transport.send({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    category: email.template,
    // Correlates SendGrid's delivery events back to this exact receipt.
    customArgs: { receipt_id: receiptId, template: email.template },
  });

  if (result.accepted) {
    await prisma.transactionalEmail.update({
      where: { id: receiptId },
      data: {
        status: 'sent',
        attempts: attempt,
        sentAt: now,
        providerMessageId: result.providerMessageId,
        sandboxed: result.sandboxed,
        nextAttemptAt: null,
        lastError: null,
        recipientEmail: null, // terminal: plaintext address no longer needed
      },
    });
    return {
      status: 'sent',
      receiptId,
      providerMessageId: result.providerMessageId,
      sandboxed: result.sandboxed,
    };
  }

  const row = await prisma.transactionalEmail.findUnique({
    where: { id: receiptId },
    select: { maxAttempts: true },
  });
  const maxAttempts = row?.maxAttempts ?? BACKOFF_MINUTES.length;
  const detail = result.status ? `HTTP ${result.status}: ${result.detail}` : result.detail;

  const retryable = result.kind === 'transient' && attempt < maxAttempts;

  if (!retryable) {
    await prisma.transactionalEmail.update({
      where: { id: receiptId },
      data: {
        status: 'failed',
        attempts: attempt,
        lastError: detail,
        nextAttemptAt: null,
        recipientEmail: null, // terminal
      },
    });
    return { status: 'failed', receiptId, reason: detail };
  }

  const nextAttemptAt = backoffFor(attempt, now);
  await prisma.transactionalEmail.update({
    where: { id: receiptId },
    data: { status: 'pending', attempts: attempt, lastError: detail, nextAttemptAt },
  });
  return { status: 'queued', receiptId, reason: detail, nextAttemptAt };
}

export type QueueRunSummary = {
  claimed: number;
  sent: number;
  queued: number;
  failed: number;
  /** Set when the queue could not run at all; `claimed` is then 0, not "nothing due". */
  skipped?: string;
};

/**
 * Drain due retries. Called by the email-queue cron route.
 *
 * A run that could not happen reports `skipped` with the reason, rather than
 * returning zero counts that read identically to a clean, empty queue.
 */
export async function runEmailQueue(options?: {
  limit?: number;
  config?: EmailConfig;
  transport?: MailTransport;
  now?: Date;
}): Promise<QueueRunSummary> {
  const config = options?.config ?? resolveEmailConfig();
  const now = options?.now ?? new Date();

  if (config.status === 'unconfigured') {
    return { claimed: 0, sent: 0, queued: 0, failed: 0, skipped: config.reason };
  }
  if (!config.enabled) {
    return {
      claimed: 0,
      sent: 0,
      queued: 0,
      failed: 0,
      skipped: 'EMAIL_ENABLED is not "true"; the queue did not run.',
    };
  }

  const transport = options?.transport ?? transportFor(config);
  if (!transport) {
    return {
      claimed: 0,
      sent: 0,
      queued: 0,
      failed: 0,
      skipped: 'No mail transport is available for the current configuration.',
    };
  }

  const due = await prisma.transactionalEmail.findMany({
    where: {
      status: 'pending',
      nextAttemptAt: { not: null, lte: now },
      recipientEmail: { not: null },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: options?.limit ?? 50,
  });

  const summary: QueueRunSummary = { claimed: due.length, sent: 0, queued: 0, failed: 0 };

  for (const row of due) {
    if (!row.recipientEmail) continue;
    // Lease the row before attempting it: push its due time out by the stall
    // margin so a second cron tick overlapping this one cannot claim the same
    // receipt and send the message twice. `attemptSend` overwrites this the
    // moment it resolves.
    await prisma.transactionalEmail.update({
      where: { id: row.id },
      data: { nextAttemptAt: new Date(now.getTime() + STALLED_ATTEMPT_MINUTES * 60_000) },
    });
    const outcome = await attemptSend(
      row.id,
      row.recipientEmail,
      {
        template: row.template as RenderedEmail['template'],
        subject: row.subject,
        text: row.bodyText ?? '',
        html: row.bodyHtml ?? '',
      },
      transport,
      row.attempts
    );
    if (outcome.status === 'sent') summary.sent += 1;
    else if (outcome.status === 'queued') summary.queued += 1;
    else summary.failed += 1;
  }

  return summary;
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(status);
}
