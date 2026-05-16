export const SENDGRID_MAX_SUBJECT_LENGTH = 998;
export const SENDGRID_MAX_BODY_LENGTH = 1_000_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email: string): boolean {
  const t = email.trim();
  return t.length > 0 && t.length <= 320 && EMAIL_RE.test(t);
}

export function normalizeSendGridMessageId(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().split('.')[0] ?? null;
}

export type SanitizedMailPayload = {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  template_id?: string;
};

export function sanitizeSendMailPayload(payload: {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  template_id?: string;
}): SanitizedMailPayload | { error: string } {
  const subject = payload.subject.trim().slice(0, SENDGRID_MAX_SUBJECT_LENGTH);
  const body_text = payload.body_text.trim().slice(0, SENDGRID_MAX_BODY_LENGTH);
  if (!subject) return { error: 'subject is required' };
  if (!body_text && !payload.template_id?.trim()) return { error: 'body_text is required' };
  return { ...payload, subject, body_text };
}
