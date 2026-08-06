import { describe, it, expect, afterEach } from 'vitest';
import { cronAuthFailure } from '@/lib/api/cron-auth';

const ORIGINAL = process.env.CRON_SECRET;

function requestWith(authorization?: string): Request {
  return new Request('https://example.test/api/cron/anything', {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe('cronAuthFailure', () => {
  it('refuses "Bearer undefined" when CRON_SECRET is unset', async () => {
    // The regression this module exists for. The previous inline comparison
    // built `Bearer ${process.env.CRON_SECRET}`, which is the literal string
    // "Bearer undefined" when the variable is missing — so this exact header
    // authorised every scheduled endpoint on a misconfigured deployment.
    delete process.env.CRON_SECRET;

    const failure = cronAuthFailure(requestWith('Bearer undefined'));
    expect(failure).not.toBeNull();
    expect(failure?.status).toBe(503);
  });

  it('refuses every request when CRON_SECRET is unset, not just the wrong ones', async () => {
    delete process.env.CRON_SECRET;
    for (const header of ['Bearer anything', 'Bearer ', undefined, 'Bearer null']) {
      expect(cronAuthFailure(requestWith(header))?.status).toBe(503);
    }
  });

  it('treats an empty or whitespace CRON_SECRET as unset', async () => {
    process.env.CRON_SECRET = '   ';
    expect(cronAuthFailure(requestWith('Bearer    '))?.status).toBe(503);
  });

  it('rejects a wrong secret with 401', async () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    const failure = cronAuthFailure(requestWith('Bearer wrong'));
    expect(failure?.status).toBe(401);
  });

  it('rejects a missing header with 401 when the secret IS configured', async () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(cronAuthFailure(requestWith(undefined))?.status).toBe(401);
  });

  it('rejects a prefix of the correct secret', async () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(cronAuthFailure(requestWith('Bearer correct-horse'))?.status).toBe(401);
  });

  it('does not accept the raw secret without the Bearer scheme', async () => {
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(cronAuthFailure(requestWith('correct-horse-battery-staple'))?.status).toBe(401);
  });

  it('authorises the correct Bearer token', async () => {
    // Negative control: if this failed too, every assertion above would pass
    // for the wrong reason.
    process.env.CRON_SECRET = 'correct-horse-battery-staple';
    expect(cronAuthFailure(requestWith('Bearer correct-horse-battery-staple'))).toBeNull();
  });
});
