import { describe, it, expect } from 'vitest';
import { buildCcwConnectionStatus } from '../status';
import type { IntegrationDiagnostic } from '@/lib/integrations/diagnostics';

const EMPTY_ENV = {} as unknown as NodeJS.ProcessEnv;

const FULL_ENV = {
  VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://user:redacted@host/db',
  JWT_SECRET_KEY: 'jwt-test-placeholder',
  CRON_SECRET: 'cron-test-placeholder',
  SENTRY_DSN: 'https://abc@sentry.example/1',
  OPENAI_API_KEY: 'sk-openai-value',
} as unknown as NodeJS.ProcessEnv;

const DIAGNOSTICS: IntegrationDiagnostic[] = [
  {
    key: 'cin7',
    label: 'Cin7',
    level: 'ok',
    liveReady: true,
    mode: 'live',
    checks: [{ level: 'ok', message: 'Cin7 environment looks ready for live mode.' }],
  },
  {
    key: 'shopify',
    label: 'Shopify',
    level: 'warning',
    liveReady: false,
    mode: 'demo',
    checks: [{ level: 'warning', message: 'SHOPIFY_MODE is demo; switch to live for production sync.' }],
  },
  {
    key: 'xero',
    label: 'Xero',
    level: 'error',
    liveReady: false,
    mode: 'live',
    checks: [{ level: 'error', message: 'Missing XERO_CLIENT_ID' }],
  },
];

describe('buildCcwConnectionStatus', () => {
  it('reports blocked infra when env is empty', () => {
    const status = buildCcwConnectionStatus(EMPTY_ENV, [], '2026-07-02T00:00:00.000Z');
    const byId = Object.fromEntries(status.connections.map((c) => [c.id, c]));

    expect(byId.database.state).toBe('blocked');
    expect(byId.auth.state).toBe('blocked');
    expect(byId.crons.state).toBe('blocked');
    expect(byId.sentry.state).toBe('unknown');
    expect(byId.ai_openai.state).toBe('blocked');
    expect(byId.unite_group.state).toBe('ready');
    expect(status.summary.total).toBe(status.connections.length);
  });

  it('maps diagnostics: live-ready caps at ready, demo mode is mock, errors block', () => {
    const status = buildCcwConnectionStatus(FULL_ENV, DIAGNOSTICS, '2026-07-02T00:00:00.000Z');
    const byId = Object.fromEntries(status.connections.map((c) => [c.id, c]));

    expect(byId.cin7.state).toBe('ready');
    expect(byId.shopify.state).toBe('mock');
    expect(byId.shopify.detail).toContain('demo mode');
    expect(byId.xero.state).toBe('blocked');
    expect(byId.xero.nextAction).toBe('Missing XERO_CLIENT_ID');
  });

  it('reports connected infra with a full env and keeps the cron caveat', () => {
    const status = buildCcwConnectionStatus(FULL_ENV, [], '2026-07-02T00:00:00.000Z');
    const byId = Object.fromEntries(status.connections.map((c) => [c.id, c]));

    expect(byId.database.state).toBe('connected');
    expect(byId.auth.state).toBe('connected');
    expect(byId.sentry.state).toBe('connected');
    expect(byId.crons.state).toBe('ready');
    expect(byId.crons.nextAction).toBe('Confirm cron enablement in the Vercel project settings.');
    expect(status.project.environment).toBe('production');
  });

  it('never leaks secret values into the payload', () => {
    const status = buildCcwConnectionStatus(FULL_ENV, DIAGNOSTICS, '2026-07-02T00:00:00.000Z');
    const serialized = JSON.stringify(status);

    for (const secret of ['jwt-secret-value', 'cron-secret-value', 'sk-openai-value', 'redacted']) {
      expect(serialized).not.toContain(secret);
    }
  });
});
