/**
 * Team invites go to one Mailtrap inbox (Toby and Phill), not SendGrid / live inboxes.
 * Does not invent MAILTRAP_API_TOKEN.
 */

export type MailtrapInviteConfig = {
  token: string;
  inboxId: string;
  fromEmail: string;
};

export function getMailtrapInviteConfig(): MailtrapInviteConfig | null {
  const token = process.env.MAILTRAP_API_TOKEN?.trim();
  const inboxId = process.env.MAILTRAP_INBOX_ID?.trim();
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL?.trim() || 'noreply@optix.local';
  if (!token || !inboxId) return null;
  return { token, inboxId, fromEmail };
}

export async function sendTeamInviteViaMailtrap(input: {
  toEmail: string;
  acceptUrl: string;
}): Promise<{ ok: true; message_id: string } | { ok: false; detail: string }> {
  const config = getMailtrapInviteConfig();
  if (!config) {
    return {
      ok: false,
      detail: 'MAILTRAP_API_TOKEN and MAILTRAP_INBOX_ID are not configured.',
    };
  }

  const res = await fetch(
    `https://sandbox.api.mailtrap.io/api/send/${encodeURIComponent(config.inboxId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { email: config.fromEmail, name: 'CCW Optix' },
        to: [{ email: input.toEmail }],
        subject: 'You are invited to Optix',
        text: `Open this link to set your password and join the workspace:\n${input.acceptUrl}\nThis link expires in 7 days.`,
        html: `<p>Open this link to set your password and join the workspace:</p><p><a href="${input.acceptUrl}">${input.acceptUrl}</a></p><p>This link expires in 7 days.</p>`,
      }),
    }
  );

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message_ids?: string[];
    errors?: unknown;
  };
  if (!res.ok || body.success === false) {
    return { ok: false, detail: 'Mailtrap rejected the invite send.' };
  }
  return { ok: true, message_id: body.message_ids?.[0] ?? 'mailtrap' };
}
