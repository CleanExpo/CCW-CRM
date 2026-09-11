/**
 * UNI-2671 A1: `configured` must never round up to `authenticated`.
 *
 * That gap is the whole incident. The settings were filled in, the request was
 * closed as done, and nobody asked SendGrid whether it accepted the credential.
 * These tests fail if any branch ever reports `authenticated` without a
 * successful provider response behind it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { getEmailHealth, __resetEmailHealthCache } from '../health';
import type { EmailConfig } from '../config';
import type { MailTransport } from '../transport';

const CONFIGURED: EmailConfig = {
  status: 'configured',
  enabled: true,
  apiKey: 'not-a-key',
  from: 'noreply@optix.ccwarehouse.com.au',
  fromName: 'CC Warehouse Optix',
  replyTo: null,
  sandbox: false,
};

function transport(verified: boolean): MailTransport {
  return {
    name: 'test',
    send: vi.fn(),
    verifyCredentials: vi.fn().mockResolvedValue(verified),
  };
}

beforeEach(() => {
  __resetEmailHealthCache();
  vi.clearAllMocks();
});

it('reports unconfigured when required values are absent, and names them', async () => {
  const health = await getEmailHealth({
    config: {
      status: 'unconfigured',
      enabled: false,
      missing: ['SENDGRID_API_KEY', 'EMAIL_FROM'],
      reason: 'not configured',
    },
  });
  expect(health.state).toBe('unconfigured');
  expect(health.missing).toEqual(['SENDGRID_API_KEY', 'EMAIL_FROM']);
  expect(health.verified).toBeNull();
});

it('reports configured — NOT authenticated — when the provider has not been asked', async () => {
  const health = await getEmailHealth({ config: CONFIGURED, probe: false });
  expect(health.state).toBe('configured');
  expect(health.verified).toBeNull();
});

it('reports configured — NOT authenticated — when the provider rejects the key', async () => {
  const health = await getEmailHealth({ config: CONFIGURED, transport: transport(false) });
  expect(health.state).toBe('configured');
  expect(health.verified).toBe(false);
});

it('reports authenticated only after the provider accepts', async () => {
  const health = await getEmailHealth({ config: CONFIGURED, transport: transport(true) });
  expect(health.state).toBe('authenticated');
  expect(health.verified).toBe(true);
  expect(health.verified_at).not.toBeNull();
});

it('does not probe by default when EMAIL_ENABLED is off', async () => {
  const t = transport(true);
  const health = await getEmailHealth({ config: { ...CONFIGURED, enabled: false }, transport: t });
  expect(t.verifyCredentials).not.toHaveBeenCalled();
  expect(health.state).toBe('configured');
});

it('flags a From address that is not the identity approved in UNI-2671', async () => {
  const health = await getEmailHealth({
    config: { ...CONFIGURED, from: 'noreply@ccw-erp.com' },
    transport: transport(true),
  });
  expect(health.from_matches_approved_identity).toBe(false);
  expect(health.message).toContain('not the identity approved');
});

it('caches the probe rather than calling the provider on every health hit', async () => {
  const t = transport(true);
  await getEmailHealth({ config: CONFIGURED, transport: t });
  await getEmailHealth({ config: CONFIGURED, transport: t });
  expect(t.verifyCredentials).toHaveBeenCalledTimes(1);
});

it('re-probes once the cache window has passed, and never serves a stale authenticated', async () => {
  const good = transport(true);
  await getEmailHealth({ config: CONFIGURED, transport: good, now: 0 });
  const bad = transport(false);
  const later = await getEmailHealth({
    config: CONFIGURED,
    transport: bad,
    now: 6 * 60_000,
  });
  expect(bad.verifyCredentials).toHaveBeenCalledTimes(1);
  expect(later.state).toBe('configured');
});
