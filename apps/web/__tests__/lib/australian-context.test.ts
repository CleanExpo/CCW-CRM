import { describe, expect, it } from 'vitest';

import {
  AU_TIMEZONE,
  formatDateAU,
  formatDateTimeAU,
  getAuTimezoneAbbreviation,
  getAuTimezoneLabel,
  getAuUtcOffsetLabel,
} from '@/lib/australian-context';

// Two known-good reference dates:
//   - 2025-07-15T00:00:00Z  → Australian winter (AEST, UTC+10)
//   - 2025-01-15T00:00:00Z  → Australian summer (AEDT, UTC+11)
const winterUtc = new Date('2025-07-15T00:00:00Z');
const summerUtc = new Date('2025-01-15T00:00:00Z');

describe('AU_TIMEZONE', () => {
  it('is the IANA Sydney zone', () => {
    expect(AU_TIMEZONE).toBe('Australia/Sydney');
  });
});

describe('getAuTimezoneAbbreviation', () => {
  it('returns AEST in July (winter)', () => {
    expect(getAuTimezoneAbbreviation(winterUtc)).toBe('AEST');
  });

  it('returns AEDT in January (summer)', () => {
    expect(getAuTimezoneAbbreviation(summerUtc)).toBe('AEDT');
  });
});

describe('getAuUtcOffsetLabel', () => {
  it('returns UTC+10 in winter', () => {
    expect(getAuUtcOffsetLabel(winterUtc)).toBe('UTC+10');
  });

  it('returns UTC+11 in summer', () => {
    expect(getAuUtcOffsetLabel(summerUtc)).toBe('UTC+11');
  });
});

describe('getAuTimezoneLabel', () => {
  it('renders "AEST (UTC+10)" in winter', () => {
    expect(getAuTimezoneLabel(winterUtc)).toBe('AEST (UTC+10)');
  });

  it('renders "AEDT (UTC+11)" in summer', () => {
    expect(getAuTimezoneLabel(summerUtc)).toBe('AEDT (UTC+11)');
  });
});

describe('formatDateAU', () => {
  it('renders DD/MM/YYYY in AU locale', () => {
    // 2025-07-15 UTC at 00:00 is 2025-07-15 10:00 AEST → still 15/07/2025
    expect(formatDateAU(winterUtc)).toBe('15/07/2025');
  });
});

describe('formatDateTimeAU', () => {
  it('renders date+time in AU timezone (winter = +10)', () => {
    // 2025-07-15T00:00:00Z → 2025-07-15 10:00:00 AEST
    expect(formatDateTimeAU(winterUtc)).toBe('15/07/2025, 10:00:00');
  });

  it('renders date+time in AU timezone (summer = +11)', () => {
    // 2025-01-15T00:00:00Z → 2025-01-15 11:00:00 AEDT
    expect(formatDateTimeAU(summerUtc)).toBe('15/01/2025, 11:00:00');
  });
});
