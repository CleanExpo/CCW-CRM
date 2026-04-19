/**
 * Australian Context Utilities
 *
 * Utilities for formatting dates, currency, phone numbers, and timezones
 * in Australian format. All time-of-day values should be rendered via
 * the helpers in this module so they honour AEST/AEDT DST transitions.
 */

export const AU_TIMEZONE = 'Australia/Sydney';

/**
 * Format date in Australian format (DD/MM/YYYY) in AU timezone
 */
export function formatDateAU(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: AU_TIMEZONE,
  }).format(date);
}

/**
 * Format a full date+time string for AU display (DD/MM/YYYY HH:MM:SS)
 * rendered in the Australia/Sydney timezone.
 */
export function formatDateTimeAU(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: AU_TIMEZONE,
  }).format(date);
}

/**
 * Return the active AU timezone abbreviation for a given date.
 * AEST (UTC+10) during standard time, AEDT (UTC+11) during daylight saving.
 */
export function getAuTimezoneAbbreviation(date: Date = new Date()): 'AEST' | 'AEDT' {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: AU_TIMEZONE,
    timeZoneName: 'short',
  }).formatToParts(date);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  return tzName.includes('AEDT') ? 'AEDT' : 'AEST';
}

/**
 * Return the UTC offset label ("UTC+10" / "UTC+11") for the active AU
 * timezone on the given date.
 */
export function getAuUtcOffsetLabel(date: Date = new Date()): 'UTC+10' | 'UTC+11' {
  return getAuTimezoneAbbreviation(date) === 'AEDT' ? 'UTC+11' : 'UTC+10';
}

/**
 * Return a human-readable AU timezone label such as "AEST (UTC+10)"
 * or "AEDT (UTC+11)" suitable for display in settings pages.
 */
export function getAuTimezoneLabel(date: Date = new Date()): string {
  return `${getAuTimezoneAbbreviation(date)} (${getAuUtcOffsetLabel(date)})`;
}

/**
 * Format currency in Australian Dollars (AUD)
 */
export function formatCurrencyAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

/**
 * Format phone number in Australian format (04XX XXX XXX)
 */
export function formatPhoneAU(phone: string): string {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as 04XX XXX XXX
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Return as-is if not a valid mobile number
  return phone;
}
