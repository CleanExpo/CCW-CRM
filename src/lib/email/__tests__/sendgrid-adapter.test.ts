/**
 * UNI-2671 A2: the SendGrid v3 adapter, against a stubbed fetch.
 *
 * Verified against the live reference on 2026-09-07: POST /v3/mail/send,
 * Bearer auth, required personalizations/from/subject, success is 202.
 * These tests pin that contract so a future edit cannot quietly start treating
 * some other status as success.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSendGridTransport } from '../providers/sendgrid';

function transportWith(fetchImpl: typeof fetch, sandbox = false) {
  return createSendGridTransport({
    apiKey: 'not-a-key',
    from: 'noreply@optix.ccwarehouse.com.au',
    fromName: 'CC Warehouse Optix',
    replyTo: null,
    sandbox,
    fetchImpl,
  });
}

const MESSAGE = { to: 'someone@example.com', subject: 'Subject', text: 'Body' };

function response(status: number, init?: { headers?: Record<string, string>; body?: unknown }) {
  return new Response(init?.body === undefined ? null : JSON.stringify(init.body), {
    status,
    headers: init?.headers,
  });
}

describe('request shape', () => {
  it('posts to the documented endpoint with bearer auth and the required fields', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(202, { headers: { 'x-message-id': 'm1' } }));
    await transportWith(fetchImpl as unknown as typeof fetch).send({
      ...MESSAGE,
      html: '<p>Body</p>',
      category: 'password-reset',
      customArgs: { receipt_id: 'r1' },
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer not-a-key');

    const body = JSON.parse(init.body);
    expect(body.personalizations[0].to).toEqual([{ email: 'someone@example.com' }]);
    expect(body.personalizations[0].custom_args).toEqual({ receipt_id: 'r1' });
    expect(body.from).toEqual({
      email: 'noreply@optix.ccwarehouse.com.au',
      name: 'CC Warehouse Optix',
    });
    expect(body.subject).toBe('Subject');
    expect(body.content).toContainEqual({ type: 'text/plain', value: 'Body' });
    expect(body.content).toContainEqual({ type: 'text/html', value: '<p>Body</p>' });
    expect(body.categories).toEqual(['password-reset']);
    // Sandbox is off, so the flag must be absent — not present-and-false.
    expect(body.mail_settings).toBeUndefined();
  });

  it("sets SendGrid's own sandbox flag when sandbox mode is on", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(202));
    await transportWith(fetchImpl as unknown as typeof fetch, true).send(MESSAGE);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.mail_settings.sandbox_mode.enable).toBe(true);
  });
});

describe('response handling', () => {
  it('accepts 202 and returns the x-message-id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response(202, { headers: { 'x-message-id': 'sg-abc' } }));
    const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
    expect(result).toMatchObject({ accepted: true, providerMessageId: 'sg-abc' });
  });

  it('does NOT treat a 200 as an accepted send — 202 is the documented success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200));
    const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
    expect(result.accepted).toBe(false);
  });

  it('classifies a 401 as permanent and surfaces the provider message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response(401, { body: { errors: [{ message: 'Permission denied, wrong credentials' }] } })
    );
    const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
    expect(result).toMatchObject({ accepted: false, kind: 'permanent', status: 401 });
    if (result.accepted) throw new Error('unreachable');
    expect(result.detail).toContain('Permission denied');
  });

  it('classifies 429 and 5xx as transient', async () => {
    for (const status of [429, 500, 503]) {
      const fetchImpl = vi.fn().mockResolvedValue(response(status));
      const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
      expect(result).toMatchObject({ accepted: false, kind: 'transient' });
    }
  });

  it('classifies a 400 as permanent — retrying a rejected message is a slower failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(400, { body: { errors: [] } }));
    const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
    expect(result).toMatchObject({ accepted: false, kind: 'permanent' });
  });

  it('treats a network failure as transient and never as accepted', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const result = await transportWith(fetchImpl as unknown as typeof fetch).send(MESSAGE);
    expect(result).toMatchObject({ accepted: false, kind: 'transient', status: null });
  });
});

describe('credential verification', () => {
  it('is true only when the provider answers ok', async () => {
    const ok = vi.fn().mockResolvedValue(response(200, { body: {} }));
    expect(await transportWith(ok as unknown as typeof fetch).verifyCredentials()).toBe(true);
  });

  it('is false — never a throw — when the provider is unreachable', async () => {
    const down = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await transportWith(down as unknown as typeof fetch).verifyCredentials()).toBe(false);
  });

  it('is false when the provider rejects the key', async () => {
    const rejected = vi.fn().mockResolvedValue(response(401));
    expect(await transportWith(rejected as unknown as typeof fetch).verifyCredentials()).toBe(
      false
    );
  });
});
