/**
 * UNI-2671 A4: opt-in contract test against the REAL SendGrid API.
 *
 * This is the only test in the suite that proves the adapter's belief about
 * SendGrid matches SendGrid. Everything else stubs `fetch` and therefore only
 * proves the adapter agrees with itself.
 *
 * It runs ONLY when `SENDGRID_SANDBOX_API_KEY` is present. When it is absent the
 * test SKIPS AND SAYS SO — loudly, by name — because a suite that silently
 * omits its only real-provider check reports the same green as one that ran it.
 * That is precisely the failure being repaired here: outbound email was assumed
 * working for two months because nothing ever asked the provider.
 *
 * It uses SendGrid's own `mail_settings.sandbox_mode`, so the message is
 * authenticated and validated by SendGrid and is NOT delivered to anyone.
 */

import { describe, it, expect } from 'vitest';
import { createSendGridTransport } from '../providers/sendgrid';
import { buildPasswordResetEmail } from '../templates';

const apiKey = process.env.SENDGRID_SANDBOX_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim() ?? 'noreply@optix.ccwarehouse.com.au';

if (!apiKey) {
  // Visible in the test output, not buried in a skip count.
  console.warn(
    '\n[SKIPPED] src/lib/email/__tests__/sendgrid-contract.test.ts — SENDGRID_SANDBOX_API_KEY is not set.\n' +
      '          The SendGrid adapter has NOT been checked against the live API in this run.\n' +
      '          Every other email test stubs fetch and proves only internal consistency.\n'
  );
}

describe.skipIf(!apiKey)('SendGrid live contract (sandbox mode — nothing is delivered)', () => {
  it('accepts the credential', async () => {
    const transport = createSendGridTransport({
      apiKey: apiKey as string,
      from,
      fromName: 'CC Warehouse Optix',
      replyTo: null,
      sandbox: true,
    });
    expect(await transport.verifyCredentials()).toBe(true);
  });

  it('returns 202 for a well-formed message in sandbox mode', async () => {
    const transport = createSendGridTransport({
      apiKey: apiKey as string,
      from,
      fromName: 'CC Warehouse Optix',
      replyTo: null,
      sandbox: true,
    });

    const email = buildPasswordResetEmail({
      resetUrl: 'https://optix.ccwarehouse.com.au/reset-password?token=contract-test',
      expiresInMinutes: 60,
    });

    const result = await transport.send({
      to: 'contract-test@example.com',
      subject: email.subject,
      text: email.text,
      html: email.html,
      category: email.template,
      customArgs: { receipt_id: 'contract-test' },
    });

    // A failure here is the useful outcome: it means the From address is not
    // domain-authenticated yet, or the key is not send-scoped.
    expect(result).toMatchObject({ accepted: true, sandboxed: true });
  });
});
