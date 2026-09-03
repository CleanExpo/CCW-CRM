import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMailtrapInviteConfig, sendTeamInviteViaMailtrap } from '../mailtrap-invite';

describe('Mailtrap invite mailer', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refuses to send when MAILTRAP_API_TOKEN is missing', () => {
    vi.stubEnv('MAILTRAP_API_TOKEN', '');
    expect(getMailtrapInviteConfig()).toBeNull();
  });

  it('posts the invite to the Mailtrap sandbox inbox, not a live provider', async () => {
    vi.stubEnv('MAILTRAP_API_TOKEN', 'mt-test-token');
    vi.stubEnv('MAILTRAP_INBOX_ID', '12345');
    vi.stubEnv('MAILTRAP_FROM_EMAIL', 'optix@example.test');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message_ids: ['mt-1'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTeamInviteViaMailtrap({
      toEmail: 'invitee@example.com',
      acceptUrl: 'https://app.example/invite/accept?token=abc',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('sandbox.api.mailtrap.io');
    expect(url).toContain('12345');
    expect(String(init.headers)).not.toMatch(/sendgrid/i);
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: [{ email: 'invitee@example.com' }],
    });
  });
});
