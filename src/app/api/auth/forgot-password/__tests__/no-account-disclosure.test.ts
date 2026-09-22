/**
 * The forgot-password response must be the same for a real account and an
 * unknown email. It says whether resets can be emailed at all (a property of
 * the deployment), never what happened to one account's email.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  setPasswordResetFields: vi.fn(),
}));
vi.mock('@/lib/email/mailer', () => ({
  sendTransactionalEmail: vi.fn(),
}));
vi.mock('@/lib/email/links', () => ({
  passwordResetUrl: (t: string) => `https://example.test/reset?token=${t}`,
}));

import { POST } from '@/app/api/auth/forgot-password/route';
import { findAppUserByEmail } from '@/lib/auth/app-user-repo';
import { sendTransactionalEmail } from '@/lib/email/mailer';

async function ask(email: string) {
  const res = await POST(
    new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  );
  return { status: res.status, body: await res.json() };
}

function accounts() {
  vi.mocked(findAppUserByEmail).mockImplementation(async (email: string) =>
    email === 'real@example.com'
      ? ({ id: 'u1', email: 'real@example.com', isActive: true } as never)
      : null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  accounts();
});
afterEach(() => vi.unstubAllEnvs());

describe('forgot-password does not reveal whether an account exists', () => {
  it('gives a real account and an unknown email the same response when email is off', async () => {
    vi.stubEnv('EMAIL_ENABLED', '');
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      status: 'refused',
      receiptId: 'r1',
      reason: 'off',
    } as never);
    const real = await ask('real@example.com');
    const unknown = await ask('nobody@example.com');
    expect(real).toEqual(unknown);
    expect(real.body.resets_available).toBe(false);
    expect(real.body).not.toHaveProperty('delivery');
  });

  it('gives the same response when email is on, even if one send fails', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SENDGRID_API_KEY', 'test-key-not-real');
    vi.stubEnv('EMAIL_FROM', 'noreply@example.test');
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      status: 'failed',
      receiptId: 'r2',
      reason: 'provider down',
    } as never);
    const real = await ask('real@example.com');
    const unknown = await ask('nobody@example.com');
    expect(real).toEqual(unknown);
    expect(real.body.resets_available).toBe(true);
  });
});
