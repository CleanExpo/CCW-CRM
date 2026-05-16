import { describe, expect, it } from 'vitest';
import {
  isValidEmailAddress,
  normalizeSendGridMessageId,
  sanitizeSendMailPayload,
  SENDGRID_MAX_SUBJECT_LENGTH,
} from '../sendgrid-utils';

describe('sendgrid-utils', () => {
  it('validates email addresses', () => {
    expect(isValidEmailAddress('user@example.com')).toBe(true);
    expect(isValidEmailAddress('bad')).toBe(false);
  });

  it('normalizes SendGrid message ids', () => {
    expect(normalizeSendGridMessageId('abc123.filter001.12345')).toBe('abc123');
  });

  it('truncates oversized subject', () => {
    const result = sanitizeSendMailPayload({
      to_email: 'a@b.com',
      subject: 'x'.repeat(SENDGRID_MAX_SUBJECT_LENGTH + 50),
      body_text: 'hello',
    });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.subject.length).toBe(SENDGRID_MAX_SUBJECT_LENGTH);
    }
  });
});
