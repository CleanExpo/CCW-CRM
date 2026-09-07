/**
 * UNI-2671 A1: configuration resolution is fail-closed.
 *
 * The negative controls matter more than the positive one. If any of these ever
 * passes with a value invented by the code rather than supplied by the
 * environment, the module has stopped fail-closing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveEmailConfig,
  describeEmailConfig,
  isEmailEnabled,
  APPROVED_SENDING_IDENTITY,
} from '../config';

const KEYS = [
  'EMAIL_ENABLED',
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'EMAIL_REPLY_TO',
  'EMAIL_SANDBOX',
  'SENDGRID_FROM_EMAIL',
  'SENDGRID_FROM_NAME',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('unconfigured', () => {
  it('is unconfigured with nothing set, and names both missing variables', () => {
    const config = resolveEmailConfig();
    expect(config.status).toBe('unconfigured');
    if (config.status !== 'unconfigured') throw new Error('unreachable');
    expect(config.missing).toEqual(['SENDGRID_API_KEY', 'EMAIL_FROM']);
  });

  it('does not fall back to the approved identity when EMAIL_FROM is unset', () => {
    process.env.SENDGRID_API_KEY = 'k';
    const config = resolveEmailConfig();
    expect(config.status).toBe('unconfigured');
    expect(JSON.stringify(config)).not.toContain(APPROVED_SENDING_IDENTITY);
  });

  it('treats whitespace as absent', () => {
    process.env.SENDGRID_API_KEY = '   ';
    process.env.EMAIL_FROM = '';
    const config = resolveEmailConfig();
    expect(config.status).toBe('unconfigured');
  });
});

describe('the enable flag', () => {
  it('is off when unset', () => {
    expect(isEmailEnabled()).toBe(false);
  });

  it.each(['1', 'yes', 'TRUE', 'True', ' true', 'on'])('is off for %o', (value) => {
    process.env.EMAIL_ENABLED = value;
    expect(isEmailEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    process.env.EMAIL_ENABLED = 'true';
    expect(isEmailEnabled()).toBe(true);
  });

  it('does not gate configuration — a configured deployment can still be switched off', () => {
    process.env.SENDGRID_API_KEY = 'k';
    process.env.EMAIL_FROM = APPROVED_SENDING_IDENTITY;
    const config = resolveEmailConfig();
    expect(config.status).toBe('configured');
    expect(config.enabled).toBe(false);
  });
});

describe('configured', () => {
  beforeEach(() => {
    process.env.SENDGRID_API_KEY = 'not-a-key';
    process.env.EMAIL_FROM = APPROVED_SENDING_IDENTITY;
    process.env.EMAIL_ENABLED = 'true';
  });

  it('prefers EMAIL_FROM over the legacy SENDGRID_FROM_EMAIL', () => {
    process.env.SENDGRID_FROM_EMAIL = 'legacy@ccw-erp.com';
    const config = resolveEmailConfig();
    if (config.status !== 'configured') throw new Error('unreachable');
    expect(config.from).toBe(APPROVED_SENDING_IDENTITY);
  });

  it('accepts the legacy value so existing senders do not regress', () => {
    delete process.env.EMAIL_FROM;
    process.env.SENDGRID_FROM_EMAIL = 'legacy@ccw-erp.com';
    const config = resolveEmailConfig();
    expect(config.status).toBe('configured');
  });

  it('marks a From on the wrong domain as not the approved identity', () => {
    process.env.EMAIL_FROM = 'noreply@ccw-erp.com';
    expect(describeEmailConfig().from_matches_approved_identity).toBe(false);
  });

  it('marks the approved identity as matching', () => {
    expect(describeEmailConfig().from_matches_approved_identity).toBe(true);
  });
});

describe('the redacted description never carries the credential', () => {
  it('omits the API key entirely', () => {
    process.env.SENDGRID_API_KEY = 'SG.a-very-distinctive-value-abc123';
    process.env.EMAIL_FROM = APPROVED_SENDING_IDENTITY;
    const described = JSON.stringify(describeEmailConfig());
    expect(described).not.toContain('SG.a-very-distinctive-value-abc123');
    expect(described).not.toContain('apiKey');
  });
});
